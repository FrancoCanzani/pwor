import { and, eq, inArray } from "drizzle-orm";

import { parseNoteDocument } from "@shared/note-frontmatter";
import { toEpochMs } from "@shared/time";

import { createDb } from "../../../db";
import { item, note } from "../../../db/schema";
import { EMBED_TOP_K, embedQuery, parseVectorId } from "../../../lib/embed";
import { snippetAround, type SearchHit } from "./query";

const SEMANTIC_ONLY_CAP = 3;
// Cosine; below this Vectorize is returning neighbors, not matches.
const MIN_SEMANTIC_SCORE = 0.55;

function itemSnippet(
  row: {
    title: string | null;
    summary: string | null;
    content: string | null;
    extractedMarkdown: string | null;
  },
  q: string,
): string | null {
  return snippetAround(
    row.extractedMarkdown || row.content || row.summary || row.title || "",
    q,
  );
}

export async function semanticSearchHits(
  env: Env,
  {
    userId,
    q,
    spaceId,
    limit,
  }: {
    userId: string;
    q: string;
    spaceId?: string;
    limit: number;
  },
): Promise<SearchHit[]> {
  const vector = await embedQuery(env, q);
  const { matches } = await env.VECTORIZE.query(vector, {
    topK: Math.min(EMBED_TOP_K, limit),
    namespace: userId,
  });
  if (matches.length === 0) return [];

  const itemIds: string[] = [];
  const noteIds: string[] = [];
  const order = new Map<string, number>();
  for (const [index, match] of matches.entries()) {
    if (match.score < MIN_SEMANTIC_SCORE) continue;
    const parsed = parseVectorId(match.id);
    if (!parsed) continue;
    const key = `${parsed.kind}:${parsed.id}`;
    order.set(key, index);
    switch (parsed.kind) {
      case "item":
        itemIds.push(parsed.id);
        break;
      case "note":
        noteIds.push(parsed.id);
        break;
      default: {
        const _exhaustive: never = parsed.kind;
        return _exhaustive;
      }
    }
  }

  if (itemIds.length === 0 && noteIds.length === 0) return [];

  const db = createDb(env.DB);
  const hits: SearchHit[] = [];

  if (itemIds.length > 0) {
    const itemFilter = [eq(item.userId, userId), inArray(item.id, itemIds)];
    if (spaceId) itemFilter.push(eq(item.spaceId, spaceId));
    const rows = await db
      .select({
        id: item.id,
        title: item.title,
        summary: item.summary,
        content: item.content,
        extractedMarkdown: item.extractedMarkdown,
        spaceId: item.spaceId,
        updatedAt: item.updatedAt,
      })
      .from(item)
      .where(and(...itemFilter));
    for (const row of rows) {
      hits.push({
        kind: "item",
        id: row.id,
        title: row.title?.trim() || "Untitled",
        snippet: itemSnippet(row, q),
        spaceId: row.spaceId,
        updatedAt: toEpochMs(row.updatedAt),
      });
    }
  }

  if (noteIds.length > 0) {
    const noteFilter = [eq(note.userId, userId), inArray(note.id, noteIds)];
    if (spaceId) noteFilter.push(eq(note.spaceId, spaceId));
    const rows = await db
      .select({
        id: note.id,
        title: note.title,
        body: note.body,
        spaceId: note.spaceId,
        updatedAt: note.updatedAt,
      })
      .from(note)
      .where(and(...noteFilter));
    for (const row of rows) {
      hits.push({
        kind: "note",
        id: row.id,
        title: row.title?.trim() || "Untitled",
        snippet: snippetAround(parseNoteDocument(row.body).body, q),
        spaceId: row.spaceId,
        updatedAt: toEpochMs(row.updatedAt),
      });
    }
  }

  return hits.sort((a, b) => {
    const aRank = order.get(`${a.kind}:${a.id}`) ?? Number.MAX_SAFE_INTEGER;
    const bRank = order.get(`${b.kind}:${b.id}`) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

export function mergeSearchHits(
  lexical: SearchHit[],
  semantic: SearchHit[],
  limit: number,
): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];

  for (const hit of lexical) {
    const key = `${hit.kind}:${hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) return out;
  }

  const cap =
    lexical.length === 0
      ? limit - out.length
      : Math.min(SEMANTIC_ONLY_CAP, limit - out.length);
  let added = 0;
  for (const hit of semantic) {
    if (added >= cap) break;
    const key = `${hit.kind}:${hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    added += 1;
  }
  return out;
}
