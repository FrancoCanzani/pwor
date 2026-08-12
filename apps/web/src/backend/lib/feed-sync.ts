import { and, eq } from "drizzle-orm";

import { createDb } from "../db";
import { feed, feedItem } from "../db/schema";
import { parseFeedXml } from "./feed-parse";

const MAX_ITEMS_PER_SYNC = 50;

export type SyncFeedResult = {
  feedId: string;
  added: number;
  updated: number;
  unchanged: boolean;
};

async function fetchFeedBody(
  url: string,
  etag: string | null,
  lastModified: string | null,
): Promise<
  | { notModified: true }
  | {
      notModified: false;
      body: string;
      etag: string | null;
      lastModified: string | null;
    }
> {
  const headers: Record<string, string> = {
    "User-Agent": "PworFeedBot/1.0 (+https://pwor.app)",
    Accept:
      "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  };
  if (etag) headers["If-None-Match"] = etag;
  if (lastModified) headers["If-Modified-Since"] = lastModified;

  const response = await fetch(url, { redirect: "follow", headers });
  if (response.status === 304) return { notModified: true };

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Feed fetch failed (${response.status})`);
  }

  return {
    notModified: false,
    body,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

export async function syncFeed(
  env: Env,
  feedId: string,
  userId: string,
): Promise<SyncFeedResult> {
  const db = createDb(env.DB);
  const [row] = await db
    .select()
    .from(feed)
    .where(and(eq(feed.id, feedId), eq(feed.userId, userId)))
    .limit(1);

  if (!row) throw new Error("Feed not found");

  try {
    const fetched = await fetchFeedBody(row.url, row.etag, row.lastModified);
    if (fetched.notModified) {
      await db
        .update(feed)
        .set({ lastSyncedAt: new Date(), syncError: null })
        .where(eq(feed.id, feedId));
      return { feedId, added: 0, updated: 0, unchanged: true };
    }

    const parsed = parseFeedXml(fetched.body, row.url);
    if (row.kind === "youtube") parsed.kind = "youtube";

    let added = 0;
    let updated = 0;
    const entries = parsed.items.slice(0, MAX_ITEMS_PER_SYNC);

    for (const entry of entries) {
      const [existing] = await db
        .select({ id: feedItem.id })
        .from(feedItem)
        .where(
          and(eq(feedItem.feedId, feedId), eq(feedItem.guid, entry.guid)),
        )
        .limit(1);

      if (existing) {
        await db
          .update(feedItem)
          .set({
            title: entry.title,
            url: entry.url,
            author: entry.author,
            summary: entry.summary,
            contentHtml: entry.contentHtml,
            imageUrl: entry.imageUrl,
            videoId: entry.videoId,
            publishedAt: entry.publishedAt,
          })
          .where(eq(feedItem.id, existing.id));
        updated += 1;
      } else {
        await db.insert(feedItem).values({
          id: crypto.randomUUID(),
          feedId,
          userId,
          guid: entry.guid,
          title: entry.title,
          url: entry.url,
          author: entry.author,
          summary: entry.summary,
          contentHtml: entry.contentHtml,
          imageUrl: entry.imageUrl,
          videoId: entry.videoId,
          publishedAt: entry.publishedAt,
        });
        added += 1;
      }
    }

    await db
      .update(feed)
      .set({
        title: parsed.title || row.title,
        siteUrl: parsed.siteUrl || row.siteUrl,
        siteName: parsed.siteName || row.siteName,
        imageUrl: parsed.imageUrl || row.imageUrl,
        kind: parsed.kind,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
        lastSyncedAt: new Date(),
        syncError: null,
      })
      .where(eq(feed.id, feedId));

    return { feedId, added, updated, unchanged: false };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Feed sync failed";
    await db
      .update(feed)
      .set({ syncError: message, lastSyncedAt: new Date() })
      .where(eq(feed.id, feedId));
    throw error;
  }
}

export async function syncAllFeedsForUser(
  env: Env,
  userId: string,
): Promise<{ synced: number; failed: number }> {
  const db = createDb(env.DB);
  const feeds = await db
    .select({ id: feed.id })
    .from(feed)
    .where(eq(feed.userId, userId));

  let synced = 0;
  let failed = 0;
  for (const row of feeds) {
    try {
      await syncFeed(env, row.id, userId);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

export async function syncAllFeeds(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const feeds = await db.select({ id: feed.id, userId: feed.userId }).from(feed);
  for (const row of feeds) {
    try {
      await syncFeed(env, row.id, row.userId);
    } catch (error) {
      console.error("feed sync failed", row.id, error);
    }
  }
}
