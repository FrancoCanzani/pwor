import type { VaultItem } from "@features/vault/api";

/** System type filters in the aside — not user collections. */
export type VaultTypeFacet =
  | "links"
  | "docs"
  | "images"
  | "text"
  | "snippets";

export const TYPE_FACET_ORDER: VaultTypeFacet[] = [
  "snippets",
  "links",
  "docs",
  "images",
  "text",
];

export const TYPE_FACET_LABEL: Record<VaultTypeFacet, string> = {
  links: "Links",
  docs: "Docs",
  images: "Images",
  text: "Text",
  snippets: "Snippets",
};

export function typeFacetOf(item: VaultItem): VaultTypeFacet {
  switch (item.kind) {
    case "link":
      return "links";
    case "text":
      return "text";
    case "snippet":
      return "snippets";
    case "file":
      if (item.mimeType?.startsWith("image/")) return "images";
      return "docs";
    default: {
      const _exhaustive: never = item.kind;
      return _exhaustive;
    }
  }
}
