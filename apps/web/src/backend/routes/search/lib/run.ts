import { buildSearchQuery, type SearchHit } from "./query";
import { mergeSearchHits, semanticSearchHits } from "./semantic";

export async function searchMemory(
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
  const { sql, params } = buildSearchQuery({
    userId,
    q,
    spaceId,
    limit,
  });

  const lexical = env.DB.prepare(sql).bind(...params).all<SearchHit>();

  const semantic = semanticSearchHits(env, {
    userId,
    q,
    spaceId,
    limit,
  }).catch((error) => {
    console.error("semantic search failed", error);
    return [] as SearchHit[];
  });

  const [{ results }, semanticHits] = await Promise.all([lexical, semantic]);
  return mergeSearchHits(results ?? [], semanticHits, limit);
}
