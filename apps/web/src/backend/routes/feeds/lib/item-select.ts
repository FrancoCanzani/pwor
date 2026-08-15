import { eq } from "drizzle-orm";

import { feed, feedItem } from "../../../db/schema";

export const feedItemSelect = {
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
  feedSiteUrl: feed.siteUrl,
  feedImageUrl: feed.imageUrl,
};

export const feedItemJoin = eq(feedItem.feedId, feed.id);
