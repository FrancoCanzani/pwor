import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { feed, feedItem } from "../../../db/schema";
import { ensureFeedItemArticle } from "../../../lib/feed-article";
import { resolveFeedUrl } from "../../../lib/feed-discover";
import {
  syncAllFeedsForUser,
  syncFeed,
} from "../../../lib/feed-sync";
import type { AppEnv } from "../../../types";

const createSchema = z.object({
  url: z.string().trim().min(1).max(2000),
});

const listItemsSchema = z.object({
  feedId: z.string().optional(),
  unread: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional()
    .transform((value) => value === "1" || value === "true"),
});

function serializeFeed<T>(row: T) {
  return row;
}

function serializeItem<T>(row: T) {
  return row;
}

const app = new Hono<AppEnv>()
  .get("/", async (c) => {
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

    return c.json({ items: rows.map(serializeFeed) });
  })

  .post("/", zValidator("json", createSchema), async (c) => {
    const user = c.get("user")!;
    const { url } = c.req.valid("json");
    const db = createDb(c.env.DB);

    let resolved: { feedUrl: string; youtube: boolean };
    try {
      resolved = await resolveFeedUrl(url);
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Could not resolve feed",
      });
    }

    const [existing] = await db
      .select({ id: feed.id })
      .from(feed)
      .where(and(eq(feed.userId, user.id), eq(feed.url, resolved.feedUrl)))
      .limit(1);

    if (existing) {
      throw new HTTPException(409, { message: "Already subscribed" });
    }

    const id = crypto.randomUUID();
    await db.insert(feed).values({
      id,
      userId: user.id,
      url: resolved.feedUrl,
      kind: resolved.youtube ? "youtube" : "rss",
      title: resolved.feedUrl,
    });

    try {
      await syncFeed(c.env, id, user.id);
    } catch (error) {
      // Keep the subscription; surface sync error on the row.
      console.error("initial feed sync failed", error);
    }

    const [created] = await db
      .select()
      .from(feed)
      .where(ownedBy(feed.id, id, feed.userId, user.id))
      .limit(1);

    return c.json(serializeFeed(created!), 201);
  })

  .post("/sync", async (c) => {
    const user = c.get("user")!;
    const result = await syncAllFeedsForUser(c.env, user.id);
    return c.json(result);
  })

  .post("/:id/sync", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    try {
      const result = await syncFeed(c.env, id, user.id);
      return c.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Feed not found") {
        throw new HTTPException(404, { message: "Not found" });
      }
      throw new HTTPException(502, {
        message: error instanceof Error ? error.message : "Sync failed",
      });
    }
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);
    const result = await db
      .delete(feed)
      .where(ownedBy(feed.id, id, feed.userId, user.id))
      .returning({ id: feed.id });
    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }
    return c.json({ ok: true });
  })

  .get("/items", zValidator("query", listItemsSchema), async (c) => {
    const user = c.get("user")!;
    const { feedId, unread } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(feedItem.userId, user.id)];
    if (feedId) conditions.push(eq(feedItem.feedId, feedId));
    if (unread) conditions.push(isNull(feedItem.readAt));

    const items = await db
      .select({
        id: feedItem.id,
        feedId: feedItem.feedId,
        title: feedItem.title,
        url: feedItem.url,
        author: feedItem.author,
        summary: feedItem.summary,
        contentHtml: feedItem.contentHtml,
        imageUrl: feedItem.imageUrl,
        videoId: feedItem.videoId,
        publishedAt: feedItem.publishedAt,
        readAt: feedItem.readAt,
        createdAt: feedItem.createdAt,
        feedTitle: feed.title,
        feedKind: feed.kind,
        feedImageUrl: feed.imageUrl,
      })
      .from(feedItem)
      .innerJoin(feed, eq(feedItem.feedId, feed.id))
      .where(and(...conditions))
      .orderBy(desc(feedItem.publishedAt), desc(feedItem.createdAt))
      .limit(200);

    return c.json({ items: items.map(serializeItem) });
  })

  .get("/items/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select({
        id: feedItem.id,
        feedId: feedItem.feedId,
        title: feedItem.title,
        url: feedItem.url,
        author: feedItem.author,
        summary: feedItem.summary,
        contentHtml: feedItem.contentHtml,
        imageUrl: feedItem.imageUrl,
        videoId: feedItem.videoId,
        publishedAt: feedItem.publishedAt,
        readAt: feedItem.readAt,
        createdAt: feedItem.createdAt,
        feedTitle: feed.title,
        feedKind: feed.kind,
        feedImageUrl: feed.imageUrl,
      })
      .from(feedItem)
      .innerJoin(feed, eq(feedItem.feedId, feed.id))
      .where(ownedBy(feedItem.id, id, feedItem.userId, user.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    const readable = await ensureFeedItemArticle(c.env, item);
    return c.json(
      serializeItem({
        ...item,
        title: readable.title,
        author: readable.author,
        summary: readable.summary,
        contentHtml: readable.contentHtml,
        imageUrl: readable.imageUrl,
      }),
    );
  })

  .post("/items/:id/read", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({
        id: feedItem.id,
        feedId: feedItem.feedId,
        title: feedItem.title,
        url: feedItem.url,
        author: feedItem.author,
        summary: feedItem.summary,
        contentHtml: feedItem.contentHtml,
        imageUrl: feedItem.imageUrl,
        videoId: feedItem.videoId,
        publishedAt: feedItem.publishedAt,
        readAt: feedItem.readAt,
        createdAt: feedItem.createdAt,
        feedTitle: feed.title,
        feedKind: feed.kind,
        feedImageUrl: feed.imageUrl,
      })
      .from(feedItem)
      .innerJoin(feed, eq(feedItem.feedId, feed.id))
      .where(ownedBy(feedItem.id, id, feedItem.userId, user.id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    if (!existing.readAt) {
      await db
        .update(feedItem)
        .set({ readAt: new Date() })
        .where(eq(feedItem.id, id));
    }

    const readable = await ensureFeedItemArticle(c.env, existing);
    return c.json(
      serializeItem({
        ...existing,
        readAt: existing.readAt ?? new Date(),
        title: readable.title,
        author: readable.author,
        summary: readable.summary,
        contentHtml: readable.contentHtml,
        imageUrl: readable.imageUrl,
      }),
    );
  });

export default app;
