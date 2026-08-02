import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { inboxItem } from "./inbox";
import { workspace } from "./workspaces";

export const vaultItem = sqliteTable("vault_item", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  workspaceId: text("project_id").references(() => workspace.id, {
    onDelete: "set null",
  }),
  inboxItemId: text("inbox_item_id").references(() => inboxItem.id, {
    onDelete: "set null",
  }),
  kind: text("kind", { enum: ["file", "link", "text"] })
    .notNull()
    .default("file"),
  title: text("title"),
  r2Key: text("r2_key"),
  mimeType: text("mime_type"),
  url: text("url"),
  siteName: text("site_name"),
  content: text("content"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
