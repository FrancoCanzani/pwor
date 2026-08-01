import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { workspace } from "./workspaces";

export const task = sqliteTable("task", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Column is still `project_id` in applied migrations; rename when you generate.
  workspaceId: text("project_id").references(() => workspace.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["open", "done", "dismissed"] })
    .notNull()
    .default("open"),
  sourceType: text("source_type", { enum: ["vault_item", "note"] }),
  sourceId: text("source_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
