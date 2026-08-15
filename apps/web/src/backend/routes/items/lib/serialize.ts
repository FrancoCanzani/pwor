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
  workspaceId: item.workspaceId,
  parseStatus: item.parseStatus,
  previewR2Key: item.previewR2Key,
  sizeBytes: sql<number>`coalesce(${item.sizeBytes}, length(cast(${item.content} as blob)), 0)`.mapWith(
    Number,
  ),
  createdAt: item.createdAt,
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
  workspaceId: string | null;
  parseStatus: "pending" | "ready" | "failed" | "skipped" | null;
  previewR2Key: string | null;
  sizeBytes: number | null;
  createdAt: Date;
  content?: string | null;
};

export function itemSizeBytes(row: {
  sizeBytes: number | null;
  content?: string | null;
}): number {
  if (row.sizeBytes != null) return row.sizeBytes;
  if (row.content) return new TextEncoder().encode(row.content).byteLength;
  return 0;
}

export function serializeItem(row: ItemRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    tags: row.tags,
    mimeType: row.mimeType,
    url: row.url,
    siteName: row.siteName,
    workspaceId: row.workspaceId,
    parseStatus: row.parseStatus,
    hasPreview: Boolean(row.previewR2Key),
    sizeBytes: itemSizeBytes(row),
    createdAt: row.createdAt,
  };
}

export function serializeItemDetail(
  row: ItemRow & {
    content: string | null;
    contentHtml: string | null;
  },
) {
  return {
    ...serializeItem(row),
    content: row.content,
    contentHtml: row.contentHtml,
  };
}
