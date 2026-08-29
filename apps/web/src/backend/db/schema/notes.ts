import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { item } from "./items";
import { space } from "./spaces";

export const note = sqliteTable(
  "note",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spaceId: text("space_id").references(() => space.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    body: text("body").notNull().default(""),
    itemId: text("item_id").references(() => item.id, {
      onDelete: "cascade",
    }),
    anchorFrom: integer("anchor_from"),
    anchorTo: integer("anchor_to"),
    anchorQuote: text("anchor_quote"),
    anchorPrefix: text("anchor_prefix"),
    anchorSuffix: text("anchor_suffix"),
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
    index("note_user_updated").on(table.userId, table.updatedAt),
    index("note_space").on(table.spaceId),
    index("note_item").on(table.itemId),
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
