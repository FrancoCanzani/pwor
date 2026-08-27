import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../../types";
import { searchMemory } from "./lib/run";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2),
  spaceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export function registerGetSearch(app: Hono<AppEnv>) {
  return app.get("/", zValidator("query", searchQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { q, spaceId, limit } = c.req.valid("query");

    return c.json({
      items: await searchMemory(c.env, {
        userId: user.id,
        q,
        spaceId,
        limit,
      }),
    });
  });
}
