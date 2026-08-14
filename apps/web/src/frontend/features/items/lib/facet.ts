import type { Item } from "@features/items/api";

/** System type filters in the aside — not user collections. */
export type ItemTypeFacet =
  | "links"
  | "docs"
  | "images"
  | "text"
  | "snippets";

export const TYPE_FACET_ORDER: ItemTypeFacet[] = [
  "snippets",
  "links",
  "docs",
  "images",
  "text",
];

export const TYPE_FACET_LABEL: Record<ItemTypeFacet, string> = {
  links: "Links",
  docs: "Docs",
  images: "Images",
  text: "Text",
  snippets: "Snippets",
};

export function typeFacetOf(item: Item): ItemTypeFacet {
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
