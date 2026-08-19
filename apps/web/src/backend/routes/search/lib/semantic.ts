import { and, eq, inArray } from "drizzle-orm";

import { toEpochMs } from "@shared/time";

import { createDb } from "../../../db";
import { item, note } from "../../../db/schema";
import { EMBED_TOP_K, embedQuery, parseVectorId } from "../../../lib/embed";
import type { SearchHit } from "./query";

const SNIPPET_CHARS = 160;

function snippetOf(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length <= SNIPPET_CHARS
    ? text
    : text.slice(0, SNIPPET_CHARS).trimEnd();
}

function itemSnippet(row: {
  title: string | null;
  summary: string | null;
}): string | null {
  return snippetOf(row.summary || row.title);
}

export async function semanticSearchHits(
  env: Env,
  {
    userId,
    q,
    workspaceId,
    limit,
  }: {
    userId: string;
    q: string;
    workspaceId?: string;
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

  const db = createDb(env.DB);
  const hits: SearchHit[] = [];

  if (itemIds.length > 0) {
    const itemFilter = [eq(item.userId, userId), inArray(item.id, itemIds)];
    if (workspaceId) itemFilter.push(eq(item.workspaceId, workspaceId));
    const rows = await db
      .select({
        id: item.id,
        title: item.title,
        summary: item.summary,
        workspaceId: item.workspaceId,
        updatedAt: item.updatedAt,
      })
      .from(item)
      .where(and(...itemFilter));
    for (const row of rows) {
      hits.push({
        kind: "item",
        id: row.id,
        title: row.title?.trim() || "Untitled",
        snippet: itemSnippet(row),
        workspaceId: row.workspaceId,
        feedId: null,
        updatedAt: toEpochMs(row.updatedAt),
      });
    }
  }

  if (noteIds.length > 0) {
    const noteFilter = [eq(note.userId, userId), inArray(note.id, noteIds)];
    if (workspaceId) noteFilter.push(eq(note.workspaceId, workspaceId));
    const rows = await db
      .select({
        id: note.id,
        title: note.title,
        body: note.body,
        workspaceId: note.workspaceId,
        updatedAt: note.updatedAt,
      })
      .from(note)
      .where(and(...noteFilter));
    for (const row of rows) {
      hits.push({
        kind: "note",
        id: row.id,
        title: row.title?.trim() || "Untitled",
        snippet: snippetOf(row.body),
        workspaceId: row.workspaceId,
        feedId: null,
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
  const scores = new Map<string, { hit: SearchHit; score: number }>();

  function add(hit: SearchHit, rank: number) {
    const key = `${hit.kind}:${hit.id}`;
    const extra = 1 / (60 + rank);
    const current = scores.get(key);
    if (current) current.score += extra;
    else scores.set(key, { hit, score: extra });
  }

  lexical.forEach((hit, rank) => add(hit, rank));
  semantic.forEach((hit, rank) => add(hit, rank));

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.hit);
}
