import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { pack } from "./packs";

export const source = sqliteTable("source", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["file", "text", "url"] })
    .notNull()
    .default("file"),
  title: text("title"),
  filename: text("filename"),
  mimeType: text("mime_type"),
  size: integer("size"),
  hash: text("hash"),
  r2Key: text("r2_key"),
  sourceUrl: text("source_url"),
  content: text("content"),
  extractedMarkdown: text("extracted_markdown"),
  parseStatus: text("parse_status", {
    enum: ["pending", "ready", "failed", "skipped"],
  })
    .notNull()
    .default("pending"),
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

export const packSource = sqliteTable(
  "pack_source",
  {
    packId: text("pack_id")
      .notNull()
      .references(() => pack.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.packId, table.sourceId] })],
);
