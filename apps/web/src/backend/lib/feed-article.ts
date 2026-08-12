import { and, eq } from "drizzle-orm";

import { createDb } from "../db";
import { feedItem } from "../db/schema";
import {
  extractArticleFromUrl,
  isThinArticleHtml,
  preferRicherHtml,
} from "./extract-article";
import { htmlToPlainText } from "./feed-html";

const MAX_EXTRACTS_PER_SYNC = 6;

export type FeedItemArticleFields = {
  id: string;
  url: string | null;
  title: string | null;
  author: string | null;
  summary: string | null;
  contentHtml: string | null;
  imageUrl: string | null;
  videoId: string | null;
};

/**
 * Fetch the article URL with Readability when the feed only gave a teaser.
 * Skips YouTube (video embed + feed description is enough).
 */
export async function ensureFeedItemArticle(
  env: Env,
  item: FeedItemArticleFields,
): Promise<FeedItemArticleFields> {
  if (item.videoId) return item;
  if (!item.url) return item;
  if (!isThinArticleHtml(item.contentHtml)) return item;

  const article = await extractArticleFromUrl(item.url);
  if (!article) return item;

  const contentHtml = preferRicherHtml(item.contentHtml, article.contentHtml);
  if (!contentHtml || contentHtml === item.contentHtml) return item;

  const summary =
    item.summary?.trim() ||
    article.excerpt ||
    htmlToPlainText(contentHtml).slice(0, 280) ||
    null;

  const db = createDb(env.DB);
  await db
    .update(feedItem)
    .set({
      title: item.title?.trim() || article.title || item.title,
      author: item.author?.trim() || article.byline || item.author,
      summary,
      contentHtml,
      imageUrl: item.imageUrl || article.imageUrl,
    })
    .where(eq(feedItem.id, item.id));

  return {
    ...item,
    title: item.title?.trim() || article.title || item.title,
    author: item.author?.trim() || article.byline || item.author,
    summary,
    contentHtml,
    imageUrl: item.imageUrl || article.imageUrl,
  };
}

/** Upgrade thin new/updated entries during sync (capped to keep cron light). */
export async function enrichThinFeedItems(
  env: Env,
  userId: string,
  feedId: string,
  itemIds: string[],
): Promise<void> {
  if (itemIds.length === 0) return;
  const db = createDb(env.DB);
  let remaining = MAX_EXTRACTS_PER_SYNC;

  for (const id of itemIds) {
    if (remaining <= 0) break;
    const [row] = await db
      .select({
        id: feedItem.id,
        url: feedItem.url,
        title: feedItem.title,
        author: feedItem.author,
        summary: feedItem.summary,
        contentHtml: feedItem.contentHtml,
        imageUrl: feedItem.imageUrl,
        videoId: feedItem.videoId,
      })
      .from(feedItem)
      .where(
        and(
          eq(feedItem.id, id),
          eq(feedItem.feedId, feedId),
          eq(feedItem.userId, userId),
        ),
      )
      .limit(1);

    if (!row || row.videoId || !row.url || !isThinArticleHtml(row.contentHtml)) {
      continue;
    }

    try {
      const next = await ensureFeedItemArticle(env, row);
      if (next.contentHtml !== row.contentHtml) remaining -= 1;
    } catch (error) {
      console.error("feed article extract failed", id, error);
    }
  }
}
