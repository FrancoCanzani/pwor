import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
} from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import { captureVideoPoster, itemAwaitingScreenshot } from "@features/items/lib/media";

export type ItemKind = "file" | "link" | "text";

export type ItemParseStatus = "pending" | "ready" | "failed" | "skipped";

type ItemBase = {
  id: string;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  spaceId: string | null;
  parseStatus: ItemParseStatus | null;
  sizeBytes: number;
  createdAt: string;
  pinned: boolean;
  duplicate?: boolean;
};

export type ItemLink = ItemBase & {
  kind: "link";
  url: string;
  siteName: string | null;
  mimeType: null;
  hasPreview: boolean;
};

export type ItemFile = ItemBase & {
  kind: "file";
  url: null;
  siteName: null;
  mimeType: string | null;
  hasPreview: boolean;
};

export type ItemText = ItemBase & {
  kind: "text";
  url: null;
  siteName: null;
  mimeType: null;
  hasPreview: false;
};

export type Item = ItemLink | ItemFile | ItemText;

export type ItemListPage = {
  items: Item[];
  total: number;
  nextCursor: string | null;
};

const ITEM_PAGE_SIZE = 50;

async function fetchItemsPage(options: {
  spaceId?: string;
  inbox?: boolean;
  cursor?: string | null;
}): Promise<ItemListPage> {
  const params = new URLSearchParams();
  if (options.inbox) params.set("inbox", "1");
  else if (options.spaceId) params.set("spaceId", options.spaceId);
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

export const itemsDeleteKey = ["items", "delete"] as const;
export const itemsMoveKey = ["items", "move"] as const;
export const itemsPinKey = ["items", "pin"] as const;

export type ItemListScope = { inbox: true } | { spaceId: string };

export function itemsInfiniteQueryOptions(scope: ItemListScope) {
  const listKey = "inbox" in scope ? "inbox" : scope.spaceId;
  return infiniteQueryOptions({
    queryKey: ["item", "items", listKey] as const,
    queryFn: ({ pageParam }) =>
      fetchItemsPage({
        inbox: "inbox" in scope,
        spaceId: "inbox" in scope ? undefined : scope.spaceId,
        cursor: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: listRefetchInterval,
  });
}

export function inboxItemsInfiniteQueryOptions() {
  return itemsInfiniteQueryOptions({ inbox: true });
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
  spaceId?: string | null,
  options?: { title?: string | null },
): Promise<Item> {
  const formData = new FormData();
  formData.append("file", file);
  if (spaceId) formData.append("spaceId", spaceId);
  if (options?.title) formData.append("title", options.title);
  const poster = await captureVideoPoster(file);
  if (poster) formData.append("poster", poster);

  return parseJson<Item>(
    await fetch("/api/items", { method: "POST", body: formData }),
  );
}

export async function captureItemInput(
  input: string,
  spaceId?: string | null,
  options?: { title?: string | null; autoSpace?: boolean },
): Promise<Item> {
  return parseJson<Item>(
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        title: options?.title || undefined,
        spaceId,
        autoSpace: options?.autoSpace || undefined,
      }),
    }),
  );
}

export async function deleteItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await parseJson<{ ids: string[] }>(
    await fetch("/api/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  );
}

export async function deleteItem(id: string): Promise<{ id: string }> {
  await deleteItems([id]);
  return { id };
}

export async function updateItems(
  ids: string[],
  patch: { spaceId?: string | null; pinned?: boolean },
): Promise<Item[]> {
  if (ids.length === 0) return [];
  const data = await parseJson<{ items: Item[] }>(
    await fetch("/api/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, ...patch }),
    }),
  );
  return data.items;
}

export async function updateItemSpace(
  id: string,
  spaceId: string | null,
): Promise<Item> {
  const [updated] = await updateItems([id], { spaceId });
  if (!updated) throw new Error("Failed to move item");
  return updated;
}

export async function updateItemPinned(
  id: string,
  pinned: boolean,
): Promise<Item> {
  const [updated] = await updateItems([id], { pinned });
  if (!updated) throw new Error("Failed to pin item");
  return updated;
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
