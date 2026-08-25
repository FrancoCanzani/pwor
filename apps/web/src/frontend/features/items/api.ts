import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
} from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import { captureVideoPoster, itemAwaitingScreenshot } from "@features/items/lib/media";

export type ItemKind = "file" | "link" | "text";

export type ItemParseStatus = "pending" | "ready" | "failed" | "skipped";

export type Item = {
  id: string;
  kind: ItemKind;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  mimeType: string | null;
  url: string | null;
  siteName: string | null;
  workspaceId: string | null;
  parseStatus: ItemParseStatus | null;
  hasPreview?: boolean;
  sizeBytes?: number | null;
  createdAt: string;
  duplicate?: boolean;
};

export type ItemListPage = {
  items: Item[];
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

const PENDING_POLL_MS = 2500;
const SCREENSHOT_POLL_MAX = 36;

function hasPendingParse(data: InfiniteData<ItemListPage> | undefined) {
  return (
    data?.pages.some((page) =>
      page.items.some((item) => item.parseStatus === "pending"),
    ) ?? false
  );
}

function hasAwaitingScreenshot(data: InfiniteData<ItemListPage> | undefined) {
  return (
    data?.pages.some((page) => page.items.some(itemAwaitingScreenshot)) ?? false
  );
}

function listRefetchInterval(query: {
  state: { data: InfiniteData<ItemListPage> | undefined; dataUpdateCount: number };
}) {
  if (hasPendingParse(query.state.data)) return PENDING_POLL_MS;
  if (
    hasAwaitingScreenshot(query.state.data) &&
    query.state.dataUpdateCount < SCREENSHOT_POLL_MAX
  ) {
    return PENDING_POLL_MS;
  }
  return false;
}

export function itemsInfiniteQueryOptions(workspaceId?: string) {
  return infiniteQueryOptions({
    queryKey: ["item", "items", workspaceId] as const,
    queryFn: ({ pageParam }) =>
      fetchItemsPage({ workspaceId, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: listRefetchInterval,
  });
}

export function inboxItemsInfiniteQueryOptions() {
  return infiniteQueryOptions({
    queryKey: ["item", "items", "inbox"] as const,
    queryFn: ({ pageParam }) =>
      fetchItemsPage({ inbox: true, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: listRefetchInterval,
  });
}

export type ItemDetail = Item & {
  content: string | null;
  contentHtml: string | null;
  extractedMarkdown: string | null;
};

export function itemQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["item", "items", id] as const,
    queryFn: async () =>
      parseJson<ItemDetail>(await fetch(`/api/items/${id}`)),
  });
}

export function itemFileTextQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["item", "file-text", id] as const,
    queryFn: async () => {
      const res = await fetch(`/api/items/${id}/file`);
      if (!res.ok) throw new Error("Failed to load file");
      return res.text();
    },
  });
}

export function itemSheetQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["item", "sheet", id] as const,
    queryFn: async () => {
      const res = await fetch(`/api/items/${id}/file`);
      if (!res.ok) throw new Error("Failed to load file");
      const buffer = await res.arrayBuffer();
      const { parseSheetWorkbook } = await import("@features/items/lib/sheet");
      return parseSheetWorkbook(buffer);
    },
  });
}

export async function uploadItem(
  file: File,
  workspaceId?: string | null,
  options?: { title?: string | null },
): Promise<Item> {
  const formData = new FormData();
  formData.append("file", file);
  if (workspaceId) formData.append("workspaceId", workspaceId);
  if (options?.title) formData.append("title", options.title);
  const poster = await captureVideoPoster(file);
  if (poster) formData.append("poster", poster);

  return parseJson<Item>(
    await fetch("/api/items", { method: "POST", body: formData }),
  );
}

export async function captureItemInput(
  input: string,
  workspaceId?: string | null,
  options?: { title?: string | null; autoSpace?: boolean },
): Promise<Item> {
  return parseJson<Item>(
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        title: options?.title || undefined,
        workspaceId,
        autoSpace: options?.autoSpace || undefined,
      }),
    }),
  );
}

export async function deleteItem(id: string): Promise<{ id: string }> {
  return parseJson<{ id: string }>(
    await fetch(`/api/items/${id}`, { method: "DELETE" }),
  );
}

export async function updateItemWorkspace(
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

export async function renameItem(id: string, title: string): Promise<Item> {
  return parseJson<Item>(
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  );
}
