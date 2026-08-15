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
const SNIPPET_CHARS = 160;

type Source = {
  kind: SearchKind;
  table: string;
  title: string;
  workspace: string;
  timestamp: string;
  body: string | null;
};

const SOURCES: Source[] = [
  {
    kind: "note",
    table: "note",
    title: "title",
    workspace: "workspace_id",
    timestamp: "updated_at",
    body: "body",
  },
  {
    kind: "item",
    table: "item",
    title: "title",
    workspace: "workspace_id",
    timestamp: "updated_at",
    body: "coalesce(summary, content, extracted_markdown, tags)",
  },
];

// `%` / `_` are LIKE wildcards — a bare `_` would match every character.
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

    return `select * from (
      select
        '${source.kind}' as kind,
        id,
        coalesce(nullif(trim(${source.title}), ''), 'Untitled') as title,
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
