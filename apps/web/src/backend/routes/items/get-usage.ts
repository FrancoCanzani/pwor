import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { item } from "../../db/schema";
import type { AppEnv } from "../../types";
import { listQuerySchema } from "./schemas";

export function registerGetItemUsage(app: Hono<AppEnv>) {
  return app.get("/usage", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, inbox } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(item.userId, user.id)];
    if (inbox) {
      conditions.push(isNull(item.workspaceId));
    } else if (workspaceId) {
      conditions.push(eq(item.workspaceId, workspaceId));
    }

    const [totals] = await db
      .select({
        totalBytes:
          sql<number>`coalesce(sum(coalesce(${item.sizeBytes}, length(cast(${item.content} as blob)), 0)), 0)`.mapWith(
            Number,
          ),
      })
      .from(item)
      .where(and(...conditions));

    return c.json({ totalBytes: totals?.totalBytes ?? 0 });
  });
}
