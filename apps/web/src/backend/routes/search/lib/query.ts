export type SearchKind = "note" | "item";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string | null;
  spaceId: string | null;
  updatedAt: number;
};

const PER_SOURCE_LIMIT = 6;
const SNIPPET_CHARS = 160;

type Source = {
  kind: SearchKind;
  from: string;
  id: string;
  title: string;
  userId: string;
  spaceColumn: string | null;
  timestamp: string;
  match: string[];
  snippet: string;
};

const SOURCES: Source[] = [
  {
    kind: "note",
    from: "note",
    id: "id",
    title: "title",
    userId: "user_id",
    spaceColumn: "space_id",
    timestamp: "updated_at",
    match: ["body"],
    snippet: `substr(trim(body), 1, ${SNIPPET_CHARS})`,
  },
  {
    kind: "item",
    from: "item",
    id: "id",
    title: "title",
    userId: "user_id",
    spaceColumn: "space_id",
    timestamp: "updated_at",
    match: ["summary", "content", "extracted_markdown", "tags"],
    snippet: `substr(trim(coalesce(extracted_markdown, content, summary, tags)), 1, ${SNIPPET_CHARS})`,
  },
];

// `%` / `_` are LIKE wildcards — a bare `_` would match every character.
function escapeLike(term: string) {
  return term.toLowerCase().replace(/[\\%_]/g, "\\$&");
}

export function buildSearchQuery({
  userId,
  q,
  spaceId,
  limit,
}: {
  userId: string;
  q: string;
  spaceId?: string;
  limit: number;
}): { sql: string; params: unknown[] } {
  const term = escapeLike(q);
  const prefix = `${term}%`;
  const infix = `%${term}%`;
  const params: unknown[] = [];

  const arms = SOURCES.filter(
    (source) => !spaceId || source.spaceColumn != null,
  ).map((source) => {
    params.push(prefix, infix, userId);
    let where = `${source.userId} = ?`;

    if (spaceId && source.spaceColumn) {
      where += ` and ${source.spaceColumn} = ?`;
      params.push(spaceId);
    }

    params.push(infix);
    where += ` and (lower(${source.title}) like ? escape '\\'`;

    for (const column of source.match) {
      params.push(infix);
      where += ` or lower(${column}) like ? escape '\\'`;
    }
    where += `)`;

    const spaceSelect = source.spaceColumn ?? "null";

    return `select * from (
      select
        '${source.kind}' as kind,
        ${source.id} as id,
        coalesce(nullif(trim(${source.title}), ''), 'Untitled') as title,
        ${source.snippet} as snippet,
        ${spaceSelect} as spaceId,
        ${source.timestamp} as updatedAt,
        case
          when lower(${source.title}) like ? escape '\\' then 0
          when lower(${source.title}) like ? escape '\\' then 1
          else 2
        end as rank
      from ${source.from}
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
