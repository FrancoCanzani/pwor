import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { feed, feedItem } from "../../db/schema";
import type { AppEnv } from "../../types";
import { feedItemJoin, feedItemSelect } from "./lib/item-select";
import { likePattern, listFeedItemsSchema } from "./schemas";

export function registerGetFeedItems(app: Hono<AppEnv>) {
  return app.get(
    "/items",
    zValidator("query", listFeedItemsSchema),
    async (c) => {
      const user = c.get("user")!;
      const { feedId, unread, q } = c.req.valid("query");
      const db = createDb(c.env.DB);

      const conditions = [eq(feedItem.userId, user.id)];
      if (feedId) conditions.push(eq(feedItem.feedId, feedId));
      if (unread) conditions.push(isNull(feedItem.readAt));
      if (q) {
        const pattern = likePattern(q);
        conditions.push(
          or(
            sql`lower(coalesce(${feedItem.title}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${feedItem.summary}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${feedItem.author}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${feed.title}, '')) like ${pattern} escape '\\'`,
          )!,
        );
      }

      const items = await db
        .select(feedItemSelect)
        .from(feedItem)
        .innerJoin(feed, feedItemJoin)
        .where(and(...conditions))
        .orderBy(desc(feedItem.publishedAt), desc(feedItem.createdAt))
        .limit(200);

      return c.json({ items });
    },
  );
}
