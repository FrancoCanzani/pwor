import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
} from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import { captureVideoPoster } from "@features/items/lib/media";

export type ItemKind = "file" | "link" | "text" | "snippet";

export type ItemParseStatus = "pending" | "ready" | "failed" | "skipped";

export type Item = {
  id: string;
  kind: ItemKind;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  language: string | null;
  mimeType: string | null;
  url: string | null;
  siteName: string | null;
  workspaceId: string | null;
  parseStatus: ItemParseStatus | null;
  /** True when a full-page site screenshot is available. */
  hasPreview?: boolean;
  sizeBytes?: number | null;
  createdAt: string;
};

export type ItemListPage = {
  items: Item[];
  /** Total item count for the current filter, across all pages. */
  total: number;
  nextCursor: string | null;
};

const ITEM_PAGE_SIZE = 50;

async function fetchItemsPage(options: {
  workspaceId?: string;
  inbox?: boolean;
  cursor?: string | null;
}): Promise<ItemListPage> {
  const params = new URLSearchParams();
  if (options.inbox) params.set("inbox", "1");
  else if (options.workspaceId) params.set("workspaceId", options.workspaceId);
  params.set("limit", String(ITEM_PAGE_SIZE));
  if (options.cursor) params.set("cursor", options.cursor);
  return parseJson<ItemListPage>(await fetch(`/api/items?${params}`));
}

/** While enrichment runs in the background, poll so "Capturing page…" resolves without a manual refresh. */
const PENDING_POLL_MS = 2500;

function hasPendingItems(data: InfiniteData<ItemListPage> | undefined) {
  return (
    data?.pages.some((page) =>
      page.items.some(
        (item) =>
          item.parseStatus === "pending" ||
          (item.kind === "link" && !item.hasPreview),
      ),
    ) ?? false
  );
}

export function itemsInfiniteQueryOptions(workspaceId?: string) {
  return infiniteQueryOptions({
    queryKey: ["item", "items", workspaceId] as const,
    queryFn: ({ pageParam }) =>
      fetchItemsPage({ workspaceId, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: (query) =>
      hasPendingItems(query.state.data) ? PENDING_POLL_MS : false,
  });
}

export function inboxItemsInfiniteQueryOptions() {
  return infiniteQueryOptions({
    queryKey: ["item", "items", "inbox"] as const,
    queryFn: ({ pageParam }) =>
      fetchItemsPage({ inbox: true, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: (query) =>
      hasPendingItems(query.state.data) ? PENDING_POLL_MS : false,
  });
}

export function itemUsageQueryOptions(workspaceId?: string) {
  return queryOptions({
    // Nested under ["item", "items"] so existing mutation invalidations refresh it too.
    queryKey: ["item", "items", "usage", workspaceId] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workspaceId) params.set("workspaceId", workspaceId);
      const query = params.toString();
      return parseJson<{ totalBytes: number }>(
        await fetch(`/api/items/usage${query ? `?${query}` : ""}`),
      );
    },
    staleTime: 60_000,
  });
}

export type ItemDetail = Item & {
  content: string | null;
  extractedMarkdown: string | null;
  language: string | null;
};

async function fetchItem(id: string): Promise<ItemDetail> {
  return parseJson<ItemDetail>(await fetch(`/api/items/${id}`));
}

export function itemQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["item", "items", id] as const,
    queryFn: () => fetchItem(id),
  });
}

async function fetchItemFileText(id: string): Promise<string> {
  const res = await fetch(`/api/items/${id}/file`);
  if (!res.ok) {
    throw new Error("Failed to load file");
  }
  return res.text();
}

export function itemFileTextQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["item", "file-text", id] as const,
    queryFn: () => fetchItemFileText(id),
  });
}

async function fetchItemSheet(id: string) {
  const res = await fetch(`/api/items/${id}/file`);
  if (!res.ok) {
    throw new Error("Failed to load file");
  }
  const buffer = await res.arrayBuffer();
  const { parseSheetWorkbook } = await import("@features/items/lib/sheet");
  return parseSheetWorkbook(buffer);
}

export function itemSheetQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["item", "sheet", id] as const,
    queryFn: () => fetchItemSheet(id),
  });
}

export async function uploadItem(
  file: File,
  workspaceId?: string | null,
  options?: { title?: string | null },
): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (workspaceId) formData.append("workspaceId", workspaceId);
  if (options?.title) formData.append("title", options.title);
  const poster = await captureVideoPoster(file);
  if (poster) formData.append("poster", poster);

  return parseJson<{ id: string }>(
    await fetch("/api/items", { method: "POST", body: formData }),
  );
}

export async function createItemSnippet(
  content: string,
  {
    title,
    language,
    workspaceId,
  }: {
    title?: string | null;
    language?: string | null;
    workspaceId?: string | null;
  } = {},
): Promise<Item> {
  return parseJson<Item>(
    await fetch("/api/items/snippet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, title, language, workspaceId }),
    }),
  );
}

export async function captureItemInput(
  input: string,
  workspaceId?: string | null,
  options?: { title?: string | null },
): Promise<Item> {
  return parseJson<Item>(
    await fetch("/api/items/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        title: options?.title || undefined,
        workspaceId,
      }),
    }),
  );
}

export async function deleteItem(id: string): Promise<{ id: string }> {
  return parseJson<{ id: string }>(
    await fetch(`/api/items/${id}`, { method: "DELETE" }),
  );
}

export async function updateItemProject(
  id: string,
  workspaceId: string | null,
): Promise<Item> {
  return parseJson<Item>(
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }),
  );
}

export async function renameItem(
  id: string,
  title: string,
): Promise<Item> {
  return parseJson<Item>(
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  );
}

export async function updateItem(
  id: string,
  patch: {
    title?: string | null;
    content?: string;
    language?: string | null;
    workspaceId?: string | null;
  },
): Promise<ItemDetail> {
  return parseJson<ItemDetail>(
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}
