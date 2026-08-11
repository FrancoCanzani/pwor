import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { inboxItem } from "./inbox";
import { workspace } from "./workspaces";

export const vaultCategory = sqliteTable("vault_category", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  workspaceId: text("project_id").references(() => workspace.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const vaultItem = sqliteTable("vault_item", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  workspaceId: text("project_id").references(() => workspace.id, {
    onDelete: "set null",
  }),
  categoryId: text("category_id").references(() => vaultCategory.id, {
    onDelete: "set null",
  }),
  inboxItemId: text("inbox_item_id").references(() => inboxItem.id, {
    onDelete: "set null",
  }),
  kind: text("kind", { enum: ["file", "link", "text"] })
    .notNull()
    .default("file"),
  title: text("title"),
  summary: text("summary"),
  /** Freeform AI tags — topics, entities, places, themes. Not a fixed enum. */
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  /** Flat searchable blob (title, summary, content, markdown, tags). */
  searchText: text("search_text"),
  r2Key: text("r2_key"),
  mimeType: text("mime_type"),
  url: text("url"),
  siteName: text("site_name"),
  content: text("content"),
  extractedMarkdown: text("extracted_markdown"),
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
});
