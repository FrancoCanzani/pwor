import type { VaultItem } from "@features/vault/api";

export type VaultCategory = "docs" | "images" | "links";

export const CATEGORY_ORDER: VaultCategory[] = ["docs", "images", "links"];

export const CATEGORY_LABEL: Record<VaultCategory, string> = {
  docs: "Docs",
  images: "Images",
  links: "Links",
};

export function categoryOf(item: VaultItem): VaultCategory {
  if (item.kind === "link") return "links";
  if (item.kind === "text") return "docs";
  if (item.mimeType?.startsWith("image/")) return "images";
  return "docs";
}
