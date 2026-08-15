export type SearchKind = "note" | "item" | "feed";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string | null;
  workspaceId: string | null;
  feedId: string | null;
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
  workspace: string | null;
  timestamp: string;
  body: string | null;
  snippet: string;
  feedId: string;
};

const SOURCES: Source[] = [
  {
    kind: "note",
    from: "note",
    id: "id",
    title: "title",
    userId: "user_id",
    workspace: "workspace_id",
    timestamp: "updated_at",
    body: "body",
    snippet: `substr(trim(body), 1, ${SNIPPET_CHARS})`,
    feedId: "null",
  },
  {
    kind: "item",
    from: "item",
    id: "id",
    title: "title",
    userId: "user_id",
    workspace: "workspace_id",
    timestamp: "updated_at",
    body: "coalesce(summary, content, extracted_markdown, tags)",
    snippet: `substr(trim(coalesce(summary, content, extracted_markdown, tags)), 1, ${SNIPPET_CHARS})`,
    feedId: "null",
  },
  {
    kind: "feed",
    from: "feed_item inner join feed on feed.id = feed_item.feed_id",
    id: "feed_item.id",
    title: "feed_item.title",
    userId: "feed_item.user_id",
    workspace: null,
    timestamp: "coalesce(feed_item.published_at, feed_item.created_at)",
    body: "coalesce(feed_item.summary, feed_item.author, feed.title)",
    snippet: "feed.title",
    feedId: "feed_item.feed_id",
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

  const arms = SOURCES.filter(
    (source) => !workspaceId || source.workspace != null,
  ).map((source) => {
    params.push(prefix, infix, userId);
    let where = `${source.userId} = ?`;

    if (workspaceId && source.workspace) {
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

    const workspaceSelect = source.workspace ?? "null";

    return `select * from (
      select
        '${source.kind}' as kind,
        ${source.id} as id,
        coalesce(nullif(trim(${source.title}), ''), 'Untitled') as title,
        ${source.snippet} as snippet,
        ${workspaceSelect} as workspaceId,
        ${source.feedId} as feedId,
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
