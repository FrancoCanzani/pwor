import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../../../types";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2),
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type SearchKind =
  "note" | "task" | "event" | "vault_item" | "inbox_item";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string | null;
  workspaceId: string | null;
  updatedAt: number;
};

type Source = {
  kind: SearchKind;
  table: string;
  title: string;
  fallback: string;
  workspace: string;
  timestamp: string;
  /** Searched and used for the snippet. Null means title-only. */
  body: string | null;
};

const SOURCES: Source[] = [
  {
    kind: "note",
    table: "note",
    title: "title",
    fallback: "Untitled",
    workspace: "project_id",
    timestamp: "updated_at",
    body: "body",
  },
  {
    kind: "task",
    table: "task",
    title: "title",
    fallback: "Untitled",
    workspace: "project_id",
    timestamp: "updated_at",
    body: null,
  },
  {
    kind: "event",
    table: "event",
    title: "title",
    fallback: "Untitled",
    workspace: "workspace_id",
    timestamp: "updated_at",
    body: null,
  },
  {
    kind: "vault_item",
    table: "vault_item",
    title: "title",
    fallback: "Untitled",
    workspace: "project_id",
    timestamp: "updated_at",
    body: "coalesce(summary, content, extracted_markdown, tags)",
  },
  {
    kind: "inbox_item",
    table: "inbox_item",
    title: "subject",
    fallback: "(no subject)",
    workspace: "workspace_id",
    timestamp: "created_at",
    body: "body",
  },
];

const PER_SOURCE_LIMIT = 6;
const SNIPPET_CHARS = 160;

/** `%` and `_` are LIKE wildcards — a bare `_` would otherwise match everything. */
function escapeLike(term: string) {
  return term.toLowerCase().replace(/[\\%_]/g, "\\$&");
}

export function buildSearchQuery({
  userId,
  q,
  workspaceId,
  limit,
}: {
  userId: string;
  q: string;
  workspaceId?: string;
  limit: number;
}): { sql: string; params: unknown[] } {
  const term = escapeLike(q);
  const prefix = `${term}%`;
  const infix = `%${term}%`;
  const params: unknown[] = [];

  // Placeholders bind in the order they appear in the SQL text, so every push
  // here has to mirror the order the `?`s are appended below.
  const arms = SOURCES.map((source) => {
    const snippet = source.body
      ? `substr(trim(${source.body}), 1, ${SNIPPET_CHARS})`
      : "null";

    params.push(prefix, infix, userId);
    let where = `user_id = ?`;

    if (workspaceId) {
      where += ` and ${source.workspace} = ?`;
      params.push(workspaceId);
    }

    params.push(infix);
    where += ` and (lower(${source.title}) like ? escape '\\'`;

    if (source.body) {
      params.push(infix);
      where += ` or lower(${source.body}) like ? escape '\\'`;
    }
    where += `)`;

    // Title-prefix beats title-infix beats body-only, so a name match wins
    // over an incidental mention buried in a body.
    return `select * from (
      select
        '${source.kind}' as kind,
        id,
        coalesce(nullif(trim(${source.title}), ''), '${source.fallback}') as title,
        ${snippet} as snippet,
        ${source.workspace} as workspaceId,
        ${source.timestamp} as updatedAt,
        case
          when lower(${source.title}) like ? escape '\\' then 0
          when lower(${source.title}) like ? escape '\\' then 1
          else 2
        end as rank
      from ${source.table}
      where ${where}
      order by rank, updatedAt desc
      limit ${PER_SOURCE_LIMIT}
    )`;
  });

  params.push(limit);

  return {
    sql: `${arms.join(" union all ")} order by rank, updatedAt desc limit ?`,
    params,
  };
}

const app = new Hono<AppEnv>().get(
  "/",
  zValidator("query", searchQuerySchema),
  async (c) => {
    const user = c.get("user")!;
    const { q, workspaceId, limit } = c.req.valid("query");

    const { sql, params } = buildSearchQuery({
      userId: user.id,
      q,
      workspaceId,
      limit,
    });

    const { results } = await c.env.DB.prepare(sql)
      .bind(...params)
      .all<SearchHit>();

    return c.json({ items: results ?? [] });
  },
);

export default app;
