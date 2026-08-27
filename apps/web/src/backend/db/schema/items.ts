import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { space } from "./spaces";

export const item = sqliteTable(
  "item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spaceId: text("space_id").references(() => space.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["file", "link", "text"] })
      .notNull()
      .default("file"),
    title: text("title"),
    summary: text("summary"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    r2Key: text("r2_key"),
    sizeBytes: integer("size_bytes"),
    mimeType: text("mime_type"),
    url: text("url"),
    normalizedUrl: text("normalized_url"),
    siteName: text("site_name"),
    content: text("content"),
    extractedMarkdown: text("extracted_markdown"),
    contentHtml: text("content_html"),
    previewR2Key: text("preview_r2_key"),
    parseStatus: text("parse_status", {
      enum: ["pending", "ready", "failed", "skipped"],
    }),
    parseError: text("parse_error"),
    parsedAt: integer("parsed_at", { mode: "timestamp_ms" }),
    embedStatus: text("embed_status", {
      enum: ["pending", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    embeddedAt: integer("embedded_at", { mode: "timestamp_ms" }),
    pinnedAt: integer("pinned_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("item_user_created").on(table.userId, table.createdAt),
    index("item_space").on(table.spaceId),
    index("item_user_normalized_url").on(table.userId, table.normalizedUrl),
  ],
);
