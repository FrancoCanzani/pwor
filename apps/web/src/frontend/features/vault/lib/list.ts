import type { VaultItem } from "@features/vault/api";
import {
  typeFacetOf,
  type VaultTypeFacet,
} from "@features/vault/lib/category";

export type VaultSort = "newest" | "oldest" | "name";

export const VAULT_SORT_LABEL: Record<VaultSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "Name",
};

export const VAULT_SORT_ORDER: VaultSort[] = ["newest", "oldest", "name"];

export type VaultNav =
  | { mode: "all" }
  | { mode: "uncategorized" }
  | { mode: "type"; type: VaultTypeFacet }
  | { mode: "category"; categoryId: string };

export function formatVaultDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function filterAndSortVaultItems(
  items: VaultItem[],
  {
    nav,
    query,
    sort,
  }: {
    nav: VaultNav;
    query: string;
    sort: VaultSort;
  },
): VaultItem[] {
  const q = query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    switch (nav.mode) {
      case "all":
        break;
      case "uncategorized":
        if (item.categoryId) return false;
        break;
      case "type":
        if (typeFacetOf(item) !== nav.type) return false;
        break;
      case "category":
        if (item.categoryId !== nav.categoryId) return false;
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

  const sorted = [...filtered];
  switch (sort) {
    case "newest":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "oldest":
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "name":
      sorted.sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", undefined, {
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

export function kindLabel(item: VaultItem): string {
  switch (item.kind) {
    case "text":
      return "text";
    case "tweet":
      return "tweet";
    case "link":
      return "link";
    case "site":
      return "site";
    case "file":
      if (item.mimeType?.startsWith("image/")) return "image";
      if (item.mimeType === "application/pdf") return "pdf";
      return "file";
    default: {
      const _exhaustive: never = item.kind;
      return _exhaustive;
    }
  }
}
