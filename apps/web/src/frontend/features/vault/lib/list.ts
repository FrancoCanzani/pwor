import type { VaultItem } from "@features/vault/api";
import { categoryOf, type VaultCategory } from "@features/vault/lib/category";

export type VaultSort = "newest" | "oldest" | "name";

export const VAULT_SORT_LABEL: Record<VaultSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "Name",
};

export const VAULT_SORT_ORDER: VaultSort[] = ["newest", "oldest", "name"];

function formatVaultDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export { formatVaultDate };

export function filterAndSortVaultItems(
  items: VaultItem[],
  {
    category,
    query,
    sort,
  }: {
    category: VaultCategory | null;
    query: string;
    sort: VaultSort;
  },
): VaultItem[] {
  const q = query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (category && categoryOf(item) !== category) return false;
    if (!q) return true;
    return (item.title ?? "").toLowerCase().includes(q);
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
