import { and, eq, inArray, sql } from "drizzle-orm";

import { createDb } from "../../../db";
import { feed, feedItem } from "../../../db/schema";
import { parseFeedXml } from "./parse";

const MAX_ITEMS_PER_SYNC = 50;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_FEED_BODY_CHARS = 3_000_000;
// 12 bound params per row — stay under D1's ~100-param cap.
const UPSERT_CHUNK = 6;

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

  const response = await fetch(url, {
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status === 304) return { notModified: true };

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Feed fetch failed (${response.status})`);
  }
  if (body.length > MAX_FEED_BODY_CHARS) {
    throw new Error("Feed body too large");
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

    if (entries.length > 0) {
      const existing = await db
        .select({ guid: feedItem.guid })
        .from(feedItem)
        .where(
          and(
            eq(feedItem.feedId, feedId),
            inArray(
              feedItem.guid,
              entries.map((entry) => entry.guid),
            ),
          ),
        );
      const existingGuids = new Set(existing.map((row) => row.guid));
      updated = entries.filter((entry) => existingGuids.has(entry.guid)).length;
      added = entries.length - updated;

      for (let i = 0; i < entries.length; i += UPSERT_CHUNK) {
        const chunk = entries.slice(i, i + UPSERT_CHUNK);
        await db
          .insert(feedItem)
          .values(
            chunk.map((entry) => ({
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
            })),
          )
          .onConflictDoUpdate({
            target: [feedItem.feedId, feedItem.guid],
            set: {
              title: sql`excluded.title`,
              url: sql`excluded.url`,
              author: sql`excluded.author`,
              summary: sql`excluded.summary`,
              contentHtml: sql`excluded.content_html`,
              imageUrl: sql`excluded.image_url`,
              videoId: sql`excluded.video_id`,
              publishedAt: sql`excluded.published_at`,
            },
          });
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
    const message = error instanceof Error ? error.message : "Feed sync failed";
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

const SYNC_ALL_CONCURRENCY = 4;

export async function syncAllFeeds(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const feeds = await db
    .select({ id: feed.id, userId: feed.userId })
    .from(feed);
  let index = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(SYNC_ALL_CONCURRENCY, feeds.length) },
      async () => {
        while (index < feeds.length) {
          const row = feeds[index++]!;
          try {
            await syncFeed(env, row.id, row.userId);
          } catch (error) {
            console.error("feed sync failed", row.id, error);
          }
        }
      },
    ),
  );
}
