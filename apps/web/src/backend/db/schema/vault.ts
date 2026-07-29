import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const vaultItem = sqliteTable("vault_item", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["uploaded", "processing", "ready", "failed"],
  })
    .notNull()
    .default("uploaded"),
  kind: text("kind", { enum: ["file", "link", "text"] })
    .notNull()
    .default("file"),
  type: text("type", {
    enum: ["passport", "id", "contract", "insurance", "other"],
  }),
  title: text("title"),
  r2Key: text("r2_key"),
  mimeType: text("mime_type"),
  url: text("url"),
  siteName: text("site_name"),
  ocrText: text("ocr_text"),
  extracted: text("extracted", { mode: "json" }).$type<
    Record<string, unknown>
  >(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  remindedAt: integer("reminded_at", { mode: "timestamp_ms" }),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
