import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export type WorkLogSource = {
  type: "task" | "note";
  id: string;
  title: string;
  at: string;
};

export const workLog = sqliteTable("work_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Calendar day as YYYY-MM-DD (user-local). */
  day: text("day").notNull(),
  body: text("body").notNull().default(""),
  draftedAt: integer("drafted_at", { mode: "timestamp_ms" }),
  sourceTaskCount: integer("source_task_count").notNull().default(0),
  sourceNoteCount: integer("source_note_count").notNull().default(0),
  sources: text("sources", { mode: "json" }).$type<WorkLogSource[]>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
