import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { feedItem } from "./feeds";
import { item } from "./items";
import { workspace } from "./workspaces";

export const note = sqliteTable(
  "note",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    body: text("body").notNull().default(""),
    itemId: text("item_id").references(() => item.id, {
      onDelete: "cascade",
    }),
    feedItemId: text("feed_item_id").references(() => feedItem.id, {
      onDelete: "cascade",
    }),
    color: text("color"),
    anchorFrom: integer("anchor_from"),
    anchorTo: integer("anchor_to"),
    anchorQuote: text("anchor_quote"),
    anchorPrefix: text("anchor_prefix"),
    anchorSuffix: text("anchor_suffix"),
    anchorPatch: text("anchor_patch"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("note_user_updated").on(table.userId, table.updatedAt),
    index("note_workspace").on(table.workspaceId),
    index("note_item").on(table.itemId),
    index("note_feed_item").on(table.feedItemId),
  ],
);

export const noteImage = sqliteTable(
  "note_image",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => note.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("note_image_note").on(table.noteId)],
);
