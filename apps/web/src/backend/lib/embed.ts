import { and, eq } from "drizzle-orm";

import { noteHasBody, parseNoteDocument } from "@shared/note-frontmatter";
import { toEpochMs } from "@shared/time";

import { createDb } from "../db";
import { item, note } from "../db/schema";

export const EMBED_MODEL = "@cf/qwen/qwen3-embedding-0.6b" as const;
export const EMBED_TOP_K = 20;

const NOTE_EMBED_SETTLE_MS = 8_000;
const SEARCH_TEXT_CHARS = 24_000;

const noteEmbedFlights = new Set<string>();

export type EmbedKind = "item" | "note";

type ItemEmbedRow = {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  siteName: string | null;
  url: string | null;
  content: string | null;
  extractedMarkdown: string | null;
  embedStatus: "pending" | "ready" | "failed";
  embeddedAt: Date | null;
  updatedAt: Date;
};

type NoteEmbedRow = {
  id: string;
  userId: string;
  title: string | null;
  body: string;
  embedStatus: "pending" | "ready" | "failed";
  embeddedAt: Date | null;
  updatedAt: Date;
};

export function vectorId(kind: EmbedKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseVectorId(
  id: string,
): { kind: EmbedKind; id: string } | null {
  if (id.startsWith("item:")) return { kind: "item", id: id.slice(5) };
  if (id.startsWith("note:")) return { kind: "note", id: id.slice(5) };
  return null;
}

function clip(value: string): string {
  return value.length <= SEARCH_TEXT_CHARS
    ? value
    : value.slice(0, SEARCH_TEXT_CHARS);
}

function itemSearchText(row: ItemEmbedRow): string {
  const tags = Array.isArray(row.tags) ? row.tags.join(", ") : "";
  const body = row.content || row.extractedMarkdown || "";
  return [
    row.title ? `TITLE: ${row.title}` : null,
    row.siteName ? `SOURCE: ${row.siteName}` : null,
    row.url ? `URL: ${row.url}` : null,
    tags ? `TAGS: ${tags}` : null,
    row.summary ? `SUMMARY: ${row.summary}` : null,
    body ? `CONTENT:\n${clip(body)}` : null,
  ]
    .filter((part): part is string => part != null)
    .join("\n");
}

function noteSearchText(row: NoteEmbedRow): string {
  const parsed = parseNoteDocument(row.body);
  const title = parsed.title || row.title || "";
  const tags = parsed.tags.join(", ");
  return [
    title ? `TITLE: ${title}` : null,
    tags ? `TAGS: ${tags}` : null,
    parsed.body ? `BODY:\n${clip(parsed.body)}` : null,
  ]
    .filter((part): part is string => part != null)
    .join("\n");
}

function isFresh(
  status: "pending" | "ready" | "failed",
  embeddedAt: Date | null,
  updatedAt: Date,
): boolean {
  if (status !== "ready" || !embeddedAt) return false;
  return toEpochMs(embeddedAt) >= toEpochMs(updatedAt);
}

async function embedDocument(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run(EMBED_MODEL, { documents: [text] });
  const values = result.data?.[0];
  if (!values?.length) throw new Error("empty embedding");
  return values;
}

export async function embedQuery(env: Env, query: string): Promise<number[]> {
  const result = await env.AI.run(EMBED_MODEL, { queries: query });
  const vector = result.data?.[0];
  if (!vector?.length) throw new Error("empty query embedding");
  return vector;
}

async function upsertVector(
  env: Env,
  kind: EmbedKind,
  id: string,
  userId: string,
  values: number[],
): Promise<void> {
  await env.VECTORIZE.upsert([
    {
      id: vectorId(kind, id),
      values,
      namespace: userId,
      metadata: { kind },
    },
  ]);
}

export async function deleteEmbeddings(env: Env, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await env.VECTORIZE.deleteByIds(ids);
  } catch (error) {
    console.error("vector delete failed", ids, error);
  }
}

async function markItemEmbed(
  env: Env,
  id: string,
  updatedAt: Date,
  status: "ready" | "failed",
): Promise<void> {
  const db = createDb(env.DB);
  await db
    .update(item)
    .set({
      embedStatus: status,
      embeddedAt: status === "ready" ? new Date() : null,
      updatedAt,
    })
    .where(and(eq(item.id, id), eq(item.updatedAt, updatedAt)));
}

async function markNoteEmbed(
  env: Env,
  id: string,
  updatedAt: Date,
  status: "ready" | "failed",
): Promise<void> {
  const db = createDb(env.DB);
  await db
    .update(note)
    .set({
      embedStatus: status,
      embeddedAt: status === "ready" ? new Date() : null,
      updatedAt,
    })
    .where(and(eq(note.id, id), eq(note.updatedAt, updatedAt)));
}

export async function embedItem(env: Env, itemId: string): Promise<void> {
  const db = createDb(env.DB);
  const [row] = await db
    .select({
      id: item.id,
      userId: item.userId,
      title: item.title,
      summary: item.summary,
      tags: item.tags,
      siteName: item.siteName,
      url: item.url,
      content: item.content,
      extractedMarkdown: item.extractedMarkdown,
      embedStatus: item.embedStatus,
      embeddedAt: item.embeddedAt,
      updatedAt: item.updatedAt,
    })
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (!row) return;
  if (isFresh(row.embedStatus, row.embeddedAt, row.updatedAt)) return;

  const text = itemSearchText(row);
  if (!text.trim()) {
    await deleteEmbeddings(env, [vectorId("item", itemId)]);
    await markItemEmbed(env, itemId, row.updatedAt, "ready");
    return;
  }

  try {
    const values = await embedDocument(env, text);
    await upsertVector(env, "item", itemId, row.userId, values);
    await markItemEmbed(env, itemId, row.updatedAt, "ready");
  } catch (error) {
    console.error("item embed failed", itemId, error);
    await markItemEmbed(env, itemId, row.updatedAt, "failed");
  }
}

export async function embedNote(env: Env, noteId: string): Promise<void> {
  const db = createDb(env.DB);
  const [row] = await db
    .select({
      id: note.id,
      userId: note.userId,
      title: note.title,
      body: note.body,
      embedStatus: note.embedStatus,
      embeddedAt: note.embeddedAt,
      updatedAt: note.updatedAt,
    })
    .from(note)
    .where(eq(note.id, noteId))
    .limit(1);

  if (!row) return;
  if (isFresh(row.embedStatus, row.embeddedAt, row.updatedAt)) return;

  if (!noteHasBody(row.body)) {
    await deleteEmbeddings(env, [vectorId("note", noteId)]);
    await markNoteEmbed(env, noteId, row.updatedAt, "ready");
    return;
  }

  const text = noteSearchText(row);
  if (!text.trim()) {
    await deleteEmbeddings(env, [vectorId("note", noteId)]);
    await markNoteEmbed(env, noteId, row.updatedAt, "ready");
    return;
  }

  try {
    const values = await embedDocument(env, text);
    await upsertVector(env, "note", noteId, row.userId, values);
    await markNoteEmbed(env, noteId, row.updatedAt, "ready");
  } catch (error) {
    console.error("note embed failed", noteId, error);
    await markNoteEmbed(env, noteId, row.updatedAt, "failed");
  }
}

export function scheduleItemEmbed(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  itemId: string,
): void {
  ctx.waitUntil(embedItem(env, itemId));
}

export function scheduleNoteEmbed(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  noteId: string,
): void {
  if (noteEmbedFlights.has(noteId)) return;
  noteEmbedFlights.add(noteId);
  ctx.waitUntil(
    scheduler
      .wait(NOTE_EMBED_SETTLE_MS)
      .then(() => embedNote(env, noteId))
      .finally(() => {
        noteEmbedFlights.delete(noteId);
      }),
  );
}
