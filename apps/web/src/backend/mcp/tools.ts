import { parseNoteDocument } from "@shared/note-frontmatter";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createDb } from "../db";
import { item, note } from "../db/schema";
import type { AppUser, WaitUntilCtx } from "../types";
import { createNote } from "../routes/notes/lib/create";
import { loadOwnedNote } from "../routes/notes/lib/load";
import { createNoteSchema } from "../routes/notes/schemas";
import { createCapturedItem } from "../routes/items/lib/create";
import { loadOwnedItem } from "../routes/items/lib/load";
import { captureSchema } from "../routes/items/schemas";
import { searchMemory } from "../routes/search/lib/run";
import type { SearchHit } from "../routes/search/lib/query";
import { listOwnedSpaces } from "../routes/spaces/lib/load";

const MAX_TOOL_CHARS = 80_000;
const EXCERPT_CHARS = 4_000;
const PARSE_WAIT_MS = 8_000;
const PARSE_POLL_MS = 400;

export type McpContext = {
  env: Env;
  user: AppUser;
  ctx: WaitUntilCtx;
};

function clip(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= MAX_TOOL_CHARS) return value;
  return `${value.slice(0, MAX_TOOL_CHARS)}\n\n[truncated]`;
}

type ItemRecord = typeof item.$inferSelect;

function excerptOf(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= EXCERPT_CHARS) return text;
  return `${text.slice(0, EXCERPT_CHARS).trimEnd()}…`;
}

function itemHasText(row: ItemRecord) {
  return Boolean(row.extractedMarkdown?.trim() || row.content?.trim());
}

async function waitForItemText(
  ctx: McpContext,
  id: string,
  row: ItemRecord,
): Promise<ItemRecord> {
  if (row.parseStatus !== "pending" || itemHasText(row)) return row;
  const db = createDb(ctx.env.DB);
  const deadline = Date.now() + PARSE_WAIT_MS;
  let current = row;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, PARSE_POLL_MS));
    current = await loadOwnedItem(db, id, ctx.user.id);
    if (current.parseStatus !== "pending" || itemHasText(current)) {
      return current;
    }
  }
  return current;
}

async function mcpSearchHits(ctx: McpContext, hits: SearchHit[]) {
  if (hits.length === 0) return [];

  const itemIds = hits.filter((hit) => hit.kind === "item").map((hit) => hit.id);
  const noteIds = hits.filter((hit) => hit.kind === "note").map((hit) => hit.id);
  const db = createDb(ctx.env.DB);

  const items = new Map<
    string,
    {
      kind: ItemRecord["kind"];
      url: string | null;
      parseStatus: ItemRecord["parseStatus"];
      excerpt: string | null;
    }
  >();
  if (itemIds.length > 0) {
    const rows = await db
      .select({
        id: item.id,
        kind: item.kind,
        url: item.url,
        parseStatus: item.parseStatus,
        extractedMarkdown: item.extractedMarkdown,
        content: item.content,
        summary: item.summary,
      })
      .from(item)
      .where(and(eq(item.userId, ctx.user.id), inArray(item.id, itemIds)));
    for (const row of rows) {
      items.set(row.id, {
        kind: row.kind,
        url: row.url,
        parseStatus: row.parseStatus,
        excerpt: excerptOf(
          row.extractedMarkdown || row.content || row.summary,
        ),
      });
    }
  }

  const notes = new Map<string, string | null>();
  if (noteIds.length > 0) {
    const rows = await db
      .select({ id: note.id, body: note.body })
      .from(note)
      .where(and(eq(note.userId, ctx.user.id), inArray(note.id, noteIds)));
    for (const row of rows) {
      notes.set(row.id, excerptOf(parseNoteDocument(row.body).body));
    }
  }

  return hits.map((hit) => {
    switch (hit.kind) {
      case "item": {
        const extra = items.get(hit.id);
        return {
          kind: hit.kind,
          id: hit.id,
          type: extra?.kind ?? null,
          title: hit.title,
          url: extra?.url ?? null,
          spaceId: hit.spaceId,
          parseStatus: extra?.parseStatus ?? null,
          excerpt: extra?.excerpt ?? hit.snippet,
          updatedAt: hit.updatedAt,
        };
      }
      case "note":
        return {
          kind: hit.kind,
          id: hit.id,
          title: hit.title,
          url: null,
          spaceId: hit.spaceId,
          excerpt: notes.get(hit.id) ?? hit.snippet,
          updatedAt: hit.updatedAt,
        };
      default: {
        const _exhaustive: never = hit.kind;
        return _exhaustive;
      }
    }
  });
}

export function mcpItem(row: ItemRecord, extra?: { duplicate?: boolean }) {
  return {
    kind: "item" as const,
    id: row.id,
    type: row.kind,
    title: row.title,
    summary: row.summary,
    tags: row.tags,
    url: row.url,
    siteName: row.siteName,
    mimeType: row.mimeType,
    spaceId: row.spaceId,
    parseStatus: row.parseStatus,
    createdAt: row.createdAt,
    text: clip(row.extractedMarkdown || row.content),
    ...(extra?.duplicate ? { duplicate: true as const } : {}),
  };
}

export const searchInput = z.object({
  q: z.string().trim().min(2).describe("What to look for"),
  spaceId: z
    .string()
    .optional()
    .describe("Only search this folder. Omit to search everything."),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function search(ctx: McpContext, args: z.infer<typeof searchInput>) {
  const hits = await searchMemory(ctx.env, {
    userId: ctx.user.id,
    q: args.q,
    spaceId: args.spaceId,
    limit: args.limit ?? 20,
  });
  return mcpSearchHits(ctx, hits);
}

export const idInput = z.object({
  id: z.string().describe("The id from search"),
});

export async function getItem(ctx: McpContext, { id }: z.infer<typeof idInput>) {
  const row = await waitForItemText(
    ctx,
    id,
    await loadOwnedItem(createDb(ctx.env.DB), id, ctx.user.id),
  );
  return mcpItem(row);
}

export async function getNote(ctx: McpContext, { id }: z.infer<typeof idInput>) {
  const row = await loadOwnedNote(createDb(ctx.env.DB), id, ctx.user.id);
  const parsed = parseNoteDocument(row.body);
  return {
    kind: "note" as const,
    id: row.id,
    title: row.title || parsed.title || null,
    spaceId: row.spaceId,
    itemId: row.itemId,
    updatedAt: row.updatedAt,
    text: clip(parsed.body),
  };
}

export async function listSpaces(ctx: McpContext) {
  const items = await listOwnedSpaces(createDb(ctx.env.DB), ctx.user.id);
  return items.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
  }));
}

export const captureInput = captureSchema.pick({
  input: true,
  title: true,
  spaceId: true,
  autoSpace: true,
});

export async function capture(
  ctx: McpContext,
  args: z.infer<typeof captureInput>,
) {
  const payload = captureSchema.parse(args);
  const { row, duplicate } = await createCapturedItem(
    ctx.env,
    ctx.ctx,
    ctx.user.id,
    payload,
  );
  return mcpItem(row, { duplicate });
}

export const createNoteInput = z.object({
  body: z.string().describe("The note, as plain text or markdown"),
  title: z.string().optional(),
  spaceId: z.string().optional(),
});

export async function createUserNote(
  ctx: McpContext,
  args: z.infer<typeof createNoteInput>,
) {
  const payload = createNoteSchema.parse({
    body: args.body,
    title: args.title,
    spaceId: args.spaceId,
  });
  const created = await createNote(ctx.env, ctx.ctx, ctx.user.id, payload);
  return {
    kind: "note" as const,
    id: created.id,
    title: created.title,
    spaceId: created.spaceId,
  };
}
