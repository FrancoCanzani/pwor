import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const feed = sqliteTable(
  "feed",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Canonical feed URL (RSS/Atom/YouTube Atom). */
    url: text("url").notNull(),
    kind: text("kind", { enum: ["rss", "atom", "youtube"] })
      .notNull()
      .default("rss"),
    title: text("title"),
    siteUrl: text("site_url"),
    siteName: text("site_name"),
    imageUrl: text("image_url"),
    etag: text("etag"),
    lastModified: text("last_modified"),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    syncError: text("sync_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("feed_user").on(table.userId)],
);

export const feedItem = sqliteTable(
  "feed_item",
  {
    id: text("id").primaryKey(),
    feedId: text("feed_id")
      .notNull()
      .references(() => feed.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    guid: text("guid").notNull(),
    title: text("title"),
    url: text("url"),
    author: text("author"),
    summary: text("summary"),
    /** Cleaned HTML body for the reader. */
    contentHtml: text("content_html"),
    imageUrl: text("image_url"),
    /** YouTube video id when kind is youtube. */
    videoId: text("video_id"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("feed_item_feed_guid").on(table.feedId, table.guid),
    index("feed_item_user_read").on(table.userId, table.readAt),
  ],
);
