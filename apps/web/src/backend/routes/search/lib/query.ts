export type SearchKind = "note" | "item";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string | null;
  workspaceId: string | null;
  updatedAt: number;
};

const PER_SOURCE_LIMIT = 6;
const SNIPPET_TOKENS = 12;

// SOH/STX — never appear in real text, so highlight() wraps are unambiguous.
const MARK_OPEN = "\u0001";
const MARK_CLOSE = "\u0002";

// `%` / `_` are LIKE wildcards — a bare `_` would match every character.
function escapeLike(term: string) {
  return term.toLowerCase().replace(/[\\%_]/g, "\\$&");
}

// Quoted prefix tokens, ANDed — FTS5 otherwise chokes on punctuation.
function buildFtsQuery(term: string): string {
  return term
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"*`)
    .join(" ");
}

const ARMS = [
  { kind: "item", table: "item_fts", titleCol: 3 },
  { kind: "note", table: "note_fts", titleCol: 3 },
] as const;

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
  const exact = q.trim().toLowerCase();
  const prefix = `${escapeLike(q)}%`;
  const ftsQuery = buildFtsQuery(q);

  const params: unknown[] = [];
  const arms = ARMS.map(({ kind, table, titleCol }) => {
    params.push(exact, prefix, ftsQuery, userId);
    if (workspaceId) params.push(workspaceId);

    return `select * from (
      select
        '${kind}' as kind,
        ${table}.id as id,
        coalesce(nullif(trim(highlight(${table}, ${titleCol}, '${MARK_OPEN}', '${MARK_CLOSE}')), ''), 'Untitled') as title,
        snippet(${table}, -1, '${MARK_OPEN}', '${MARK_CLOSE}', '…', ${SNIPPET_TOKENS}) as snippet,
        ${table}.workspace_id as workspaceId,
        ${table}.updated_at as updatedAt,
        case
          when lower(${table}.title) = ? then bm25(${table}) - 1000
          when lower(${table}.title) like ? escape '\\' then bm25(${table}) - 100
          else bm25(${table})
        end as rank
      from ${table}
      where ${table} match ?
        and ${table}.user_id = ?
        ${workspaceId ? `and ${table}.workspace_id = ?` : ""}
      order by rank
      limit ${PER_SOURCE_LIMIT}
    )`;
  });

  params.push(limit);

  return {
    sql: `${arms.join(" union all ")} order by rank limit ?`,
    params,
  };
}
