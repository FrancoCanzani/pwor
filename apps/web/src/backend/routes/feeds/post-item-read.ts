import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { feedItem } from "../../db/schema";
import type { AppEnv } from "../../types";

export function registerPostFeedItemRead(app: Hono<AppEnv>) {
  return app.post("/items/:id/read", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: feedItem.id, readAt: feedItem.readAt })
      .from(feedItem)
      .where(ownedBy(feedItem.id, id, feedItem.userId, user.id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    if (!existing.readAt) {
      await db
        .update(feedItem)
        .set({ readAt: new Date() })
        .where(eq(feedItem.id, id));
    }

    const [row] = await db
      .select()
      .from(feedItem)
      .where(eq(feedItem.id, id))
      .limit(1);

    return c.json(row!);
  });
}
