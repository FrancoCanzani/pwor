import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type FeedKind = "rss" | "atom" | "youtube";

export type Feed = {
  id: string;
  url: string;
  kind: FeedKind;
  title: string | null;
  siteUrl: string | null;
  siteName: string | null;
  imageUrl: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  unreadCount: number;
};

export type FeedItem = {
  id: string;
  feedId: string;
  title: string | null;
  url: string | null;
  author: string | null;
  summary: string | null;
  contentHtml: string | null;
  imageUrl: string | null;
  videoId: string | null;
  publishedAt: string | null;
  readAt: string | null;
  createdAt: string;
  feedTitle: string | null;
  feedKind: FeedKind;
  feedSiteUrl: string | null;
  feedImageUrl: string | null;
};

async function fetchFeeds(): Promise<Feed[]> {
  const data = await parseJson<{ items: Feed[] }>(await fetch("/api/feeds"));
  return data.items;
}

export function feedsQueryOptions() {
  return queryOptions({
    queryKey: ["feeds", "list"] as const,
    queryFn: fetchFeeds,
  });
}

async function fetchFeedItems(options?: {
  feedId?: string;
  unread?: boolean;
  q?: string;
}): Promise<FeedItem[]> {
  const params = new URLSearchParams();
  if (options?.feedId) params.set("feedId", options.feedId);
  if (options?.unread) params.set("unread", "1");
  if (options?.q) params.set("q", options.q);
  const query = params.toString();
  const data = await parseJson<{ items: FeedItem[] }>(
    await fetch(`/api/feeds/items${query ? `?${query}` : ""}`),
  );
  return data.items;
}

export function feedItemsQueryOptions(options?: {
  feedId?: string;
  unread?: boolean;
  q?: string;
}) {
  return queryOptions({
    queryKey: [
      "feeds",
      "items",
      options?.feedId ?? "all",
      options?.unread ? "unread" : "all",
      options?.q ?? "",
    ] as const,
    queryFn: () => fetchFeedItems(options),
    placeholderData: (previous) => previous,
  });
}

export async function createFeed(url: string): Promise<Feed> {
  return parseJson<Feed>(
    await fetch("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
}

export async function deleteFeed(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/feeds/${id}`, { method: "DELETE" }),
  );
}

export async function syncFeed(id: string): Promise<void> {
  await parseJson(await fetch(`/api/feeds/${id}/sync`, { method: "POST" }));
}

export async function syncAllFeeds(): Promise<void> {
  await parseJson(await fetch("/api/feeds/sync", { method: "POST" }));
}

export async function markFeedItemRead(id: string): Promise<FeedItem> {
  return parseJson<FeedItem>(
    await fetch(`/api/feeds/items/${id}/read`, { method: "POST" }),
  );
}
