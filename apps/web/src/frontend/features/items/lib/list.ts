import { format, isValid } from "date-fns";

import type { Item } from "@features/items/api";
import { typeFacetOf, type ItemTypeFacet } from "@features/items/lib/facet";
import { isSheetPreviewable } from "@features/items/lib/sheet";

export type ItemSort = "newest" | "oldest" | "name";

export const ITEM_SORT_LABEL: Record<ItemSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "Name",
};

export const ITEM_SORT_ORDER: ItemSort[] = ["newest", "oldest", "name"];

export type ItemNav = { mode: "all" } | { mode: "type"; type: ItemTypeFacet };

export function formatItemDate(value: string): string {
  const date = new Date(value);
  if (!isValid(date)) return "";
  return format(date, "MMM d, yyyy, h:mm a");
}

export function filterAndSortItems(
  items: Item[],
  {
    nav,
    query,
    sort,
  }: {
    nav: ItemNav;
    query: string;
    sort: ItemSort;
  },
): Item[] {
  const q = query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    switch (nav.mode) {
      case "all":
        break;
      case "type":
        if (typeFacetOf(item) !== nav.type) return false;
        break;
      default: {
        const _exhaustive: never = nav;
        return _exhaustive;
      }
    }

    if (!q) return true;
    const haystack = [
      item.title,
      item.summary,
      item.url,
      item.siteName,
      ...(item.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return sortItems(filtered, sort);
}

export function sortBy<T>(
  rows: T[],
  sort: ItemSort,
  accessors: {
    date: (row: T) => string;
    name: (row: T) => string;
  },
): T[] {
  const sorted = [...rows];
  switch (sort) {
    case "newest":
      sorted.sort((a, b) => accessors.date(b).localeCompare(accessors.date(a)));
      break;
    case "oldest":
      sorted.sort((a, b) => accessors.date(a).localeCompare(accessors.date(b)));
      break;
    case "name":
      sorted.sort((a, b) =>
        accessors.name(a).localeCompare(accessors.name(b), undefined, {
          sensitivity: "base",
        }),
      );
      break;
    default: {
      const _exhaustive: never = sort;
      return _exhaustive;
    }
  }
  return sorted;
}

export function sortItems(items: Item[], sort: ItemSort): Item[] {
  return sortBy(items, sort, {
    date: (item) => item.createdAt,
    name: (item) => item.title ?? "",
  });
}

export function kindLabel(item: Item): string {
  switch (item.kind) {
    case "text":
      return "text";
    case "link":
      return "link";
    case "file":
      if (item.mimeType?.startsWith("image/")) return "image";
      if (item.mimeType?.startsWith("video/")) return "video";
      if (item.mimeType === "application/pdf") return "pdf";
      if (isSheetPreviewable(item.mimeType, item.title)) return "sheet";
      return "file";
    default: {
      const _exhaustive: never = item.kind;
      return _exhaustive;
    }
  }
}
