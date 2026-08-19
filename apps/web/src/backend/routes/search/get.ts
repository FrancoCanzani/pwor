import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../../types";
import { buildSearchQuery, type SearchHit } from "./lib/query";
import { mergeSearchHits, semanticSearchHits } from "./lib/semantic";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2),
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export function registerGetSearch(app: Hono<AppEnv>) {
  return app.get("/", zValidator("query", searchQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { q, workspaceId, limit } = c.req.valid("query");

    const { sql, params } = buildSearchQuery({
      userId: user.id,
      q,
      workspaceId,
      limit,
    });

    const lexical = c.env.DB.prepare(sql)
      .bind(...params)
      .all<SearchHit>();

    const semantic = semanticSearchHits(c.env, {
      userId: user.id,
      q,
      workspaceId,
      limit,
    }).catch((error) => {
      console.error("semantic search failed", error);
      return [] as SearchHit[];
    });

    const [{ results }, semanticHits] = await Promise.all([lexical, semantic]);

    return c.json({
      items: mergeSearchHits(results ?? [], semanticHits, limit),
    });
  });
}
