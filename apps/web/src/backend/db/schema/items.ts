import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { workspace } from "./workspaces";

export const item = sqliteTable(
  "item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["file", "link", "text", "snippet"] })
      .notNull()
      .default("file"),
    title: text("title"),
    summary: text("summary"),
    /** Freeform AI tags — topics, entities, places, themes. Not a fixed enum. */
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    /** Language id for snippets (e.g. typescript, python). */
    language: text("language"),
    r2Key: text("r2_key"),
    /** Stored byte size for R2-backed files; content-backed kinds compute from `content`. */
    sizeBytes: integer("size_bytes"),
    mimeType: text("mime_type"),
    url: text("url"),
    normalizedUrl: text("normalized_url"),
    siteName: text("site_name"),
    content: text("content"),
    extractedMarkdown: text("extracted_markdown"),
    /** Site screenshot or video poster in R2. */
    previewR2Key: text("preview_r2_key"),
    parseStatus: text("parse_status", {
      enum: ["pending", "ready", "failed", "skipped"],
    }),
    parseError: text("parse_error"),
    parsedAt: integer("parsed_at", { mode: "timestamp_ms" }),
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
    index("item_workspace").on(table.workspaceId),
    index("item_user_normalized_url").on(table.userId, table.normalizedUrl),
  ],
);
