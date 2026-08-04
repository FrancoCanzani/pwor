import type { VaultItem } from "@features/vault/api";

export type VaultCategory = "docs" | "images";

export const CATEGORY_ORDER: VaultCategory[] = ["docs", "images"];

export const CATEGORY_LABEL: Record<VaultCategory, string> = {
  docs: "Docs",
  images: "Images",
};

export function categoryOf(item: VaultItem): VaultCategory {
  if (item.mimeType?.startsWith("image/")) return "images";
  return "docs";
}
