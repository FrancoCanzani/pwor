import { desc, eq, sql } from "drizzle-orm";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { feed } from "../../db/schema";
import type { AppEnv } from "../../types";

export function registerGetAllFeeds(app: Hono<AppEnv>) {
  return app.get("/", async (c) => {
    const user = c.get("user")!;
    const db = createDb(c.env.DB);

    const rows = await db
      .select({
        id: feed.id,
        url: feed.url,
        kind: feed.kind,
        title: feed.title,
        siteUrl: feed.siteUrl,
        siteName: feed.siteName,
        imageUrl: feed.imageUrl,
        lastSyncedAt: feed.lastSyncedAt,
        syncError: feed.syncError,
        createdAt: feed.createdAt,
        unreadCount: sql<number>`(
          select count(*) from feed_item
          where feed_item.feed_id = ${feed.id}
            and feed_item.read_at is null
        )`.mapWith(Number),
      })
      .from(feed)
      .where(eq(feed.userId, user.id))
      .orderBy(desc(feed.updatedAt));

    return c.json({ items: rows });
  });
}
