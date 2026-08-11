import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/** Short-lived pairing codes for linking a browser extension. */
export const extensionPairing = sqliteTable("extension_pairing", {
  id: text("id").primaryKey(),
  secretHash: text("secret_hash").notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  token: text("token"),
  status: text("status", {
    enum: ["pending", "approved", "consumed", "expired"],
  })
    .notNull()
    .default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

/** Long-lived extension credentials (Bearer tokens). */
export const extensionDevice = sqliteTable("extension_device", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  name: text("name").notNull().default("Browser"),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});
