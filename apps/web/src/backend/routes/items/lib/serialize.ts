import { sql } from "drizzle-orm";

import { item } from "../../../db/schema";

export const itemListColumns = {
  id: item.id,
  kind: item.kind,
  title: item.title,
  summary: item.summary,
  tags: item.tags,
  mimeType: item.mimeType,
  url: item.url,
  siteName: item.siteName,
  spaceId: item.spaceId,
  parseStatus: item.parseStatus,
  previewR2Key: item.previewR2Key,
  sizeBytes: sql<number>`coalesce(${item.sizeBytes}, length(cast(${item.content} as blob)), 0)`.mapWith(
    Number,
  ),
  createdAt: item.createdAt,
  pinnedAt: item.pinnedAt,
};

export type ItemRow = {
  id: string;
  kind: "file" | "link" | "text";
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  mimeType: string | null;
  url: string | null;
  siteName: string | null;
  spaceId: string | null;
  parseStatus: "pending" | "ready" | "failed" | "skipped" | null;
  previewR2Key: string | null;
  sizeBytes: number | null;
  createdAt: Date;
  pinnedAt: Date | null;
};

type ItemBase = {
  id: string;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  spaceId: string | null;
  parseStatus: ItemRow["parseStatus"];
  sizeBytes: number;
  createdAt: Date;
  pinned: boolean;
};

export type SerializedItemLink = ItemBase & {
  kind: "link";
  url: string;
  siteName: string | null;
  mimeType: null;
  hasPreview: boolean;
};

export type SerializedItemFile = ItemBase & {
  kind: "file";
  url: null;
  siteName: null;
  mimeType: string | null;
  hasPreview: boolean;
};

export type SerializedItemText = ItemBase & {
  kind: "text";
  url: null;
  siteName: null;
  mimeType: null;
  hasPreview: false;
};

export type SerializedItem =
  | SerializedItemLink
  | SerializedItemFile
  | SerializedItemText;

export function itemSizeBytes(row: {
  sizeBytes: number | null;
  content?: string | null;
}): number {
  if (row.sizeBytes != null) return row.sizeBytes;
  if (row.content) return new TextEncoder().encode(row.content).byteLength;
  return 0;
}

function itemBase(row: ItemRow): ItemBase {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    tags: row.tags,
    spaceId: row.spaceId,
    parseStatus: row.parseStatus,
    sizeBytes: itemSizeBytes(row),
    createdAt: row.createdAt,
    pinned: row.pinnedAt != null,
  };
}

export function serializeItem(row: ItemRow): SerializedItem {
  switch (row.kind) {
    case "link":
      return {
        ...itemBase(row),
        kind: "link",
        url: row.url ?? "",
        siteName: row.siteName,
        mimeType: null,
        hasPreview: Boolean(row.previewR2Key),
      };
    case "file":
      return {
        ...itemBase(row),
        kind: "file",
        url: null,
        siteName: null,
        mimeType: row.mimeType,
        hasPreview: Boolean(row.previewR2Key),
      };
    case "text":
      return {
        ...itemBase(row),
        kind: "text",
        url: null,
        siteName: null,
        mimeType: null,
        hasPreview: false,
      };
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

export function serializeItemDetail(
  row: ItemRow & {
    content: string | null;
    contentHtml: string | null;
    extractedMarkdown?: string | null;
  },
) {
  return {
    ...serializeItem(row),
    content: row.content,
    contentHtml: row.contentHtml,
    extractedMarkdown: row.extractedMarkdown ?? null,
  };
}
