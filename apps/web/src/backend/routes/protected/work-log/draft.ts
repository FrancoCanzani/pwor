import { and, desc, eq, gte, lt } from "drizzle-orm";

import type { Db } from "../../../db";
import { note, task, type WorkLogSource } from "../../../db/schema";
import {
  QUIET_DAY_BODY,
  WORK_LOG_MODEL,
  WORK_LOG_SYSTEM_PROMPT,
} from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE_SOURCES = 5;
const MIN_NOTE_BODY_CHARS = 24;
const NOTE_EXCERPT_CHARS = 280;

type DraftSource = WorkLogSource & {
  excerpt?: string;
};

function parseYearMonthDay(value: string): {
  y: number;
  m: number;
  d: number;
} | null {
  if (!DATE_ONLY.test(value)) return null;
  const [yText, mText, dText] = value.split("-");
  const y = Number(yText);
  const m = Number(mText);
  const d = Number(dText);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  return { y, m, d };
}

export function isDayDate(value: string): boolean {
  const parts = parseYearMonthDay(value);
  if (!parts) return false;
  const { y, m, d } = parts;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** YYYY-MM-DD for a calendar instant in UTC. */
export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dayRange(day: string): { start: Date; end: Date } {
  const parts = parseYearMonthDay(day);
  if (!parts) {
    throw new Error(`Invalid day: ${day}`);
  }
  const start = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}

function toIso(value: Date | string | number): string {
  return new Date(value).toISOString();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstLine(body: string): string | null {
  const line = body
    .split("\n")
    .map((part) => part.replace(/^#+\s*/, "").trim())
    .find((part) => part.length > 0);
  return line ?? null;
}

function noteTitle(title: string | null, body: string): string | null {
  if (title?.trim()) return title.trim();
  const line = firstLine(body);
  if (!line || line.length < 3) return null;
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

function isMeaningfulNote(title: string | null, body: string): boolean {
  const cleaned = collapseWhitespace(body);
  if (cleaned.length < MIN_NOTE_BODY_CHARS) return false;
  const resolved = noteTitle(title, body);
  if (!resolved) return false;
  if (/^untitled(?:\s+note)?$/i.test(resolved)) return false;
  return true;
}

function noteExcerpt(body: string): string {
  const cleaned = collapseWhitespace(body);
  if (cleaned.length <= NOTE_EXCERPT_CHARS) return cleaned;
  return `${cleaned.slice(0, NOTE_EXCERPT_CHARS - 1)}…`;
}

function extractResponseText(result: unknown): string {
  if (result && typeof result === "object" && "response" in result) {
    const value = (result as { response?: unknown }).response;
    if (typeof value === "string") return value;
  }
  return "";
}

function fallbackBody(sources: DraftSource[]): string {
  const tasks = sources.filter((source) => source.type === "task");
  if (tasks.length === 1) return `Closed out ${tasks[0]!.title}.`;
  if (tasks.length > 1) {
    return tasks.map((source) => `- ${source.title}`).join("\n");
  }

  const notes = sources.filter((source) => source.type === "note");
  if (notes.length === 1) return `Worked on ${notes[0]!.title}.`;
  if (notes.length > 1) {
    return `Caught up on ${notes
      .slice(0, 3)
      .map((source) => source.title)
      .join(", ")}.`;
  }

  return QUIET_DAY_BODY;
}

function toStoredSources(sources: DraftSource[]): WorkLogSource[] {
  return sources.map(({ type, id, title, at }) => ({ type, id, title, at }));
}

function formatDraftPayload(sources: DraftSource[]): string {
  return sources
    .map((source) => {
      const head = `- [${source.type}] ${source.title} (${source.at.slice(0, 10)})`;
      if (source.type === "note" && source.excerpt) {
        return `${head}\n  excerpt: ${source.excerpt}`;
      }
      return head;
    })
    .join("\n");
}

export async function collectDaySources(
  db: Db,
  userId: string,
  day: string,
): Promise<{
  sources: DraftSource[];
  sourceTaskCount: number;
  sourceNoteCount: number;
}> {
  const { start, end } = dayRange(day);

  const closedTasks = await db
    .select({
      id: task.id,
      title: task.title,
      updatedAt: task.updatedAt,
    })
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        eq(task.status, "done"),
        gte(task.updatedAt, start),
        lt(task.updatedAt, end),
      ),
    )
    .orderBy(desc(task.updatedAt));

  const changedNotes = await db
    .select({
      id: note.id,
      title: note.title,
      body: note.body,
      updatedAt: note.updatedAt,
    })
    .from(note)
    .where(
      and(
        eq(note.userId, userId),
        gte(note.updatedAt, start),
        lt(note.updatedAt, end),
      ),
    )
    .orderBy(desc(note.updatedAt));

  const taskSources: DraftSource[] = closedTasks
    .filter((item) => item.title.trim().length > 0)
    .map((item) => ({
      type: "task" as const,
      id: item.id,
      title: item.title.trim(),
      at: toIso(item.updatedAt),
    }));

  const noteSources: DraftSource[] = [];
  for (const item of changedNotes) {
    if (noteSources.length >= MAX_NOTE_SOURCES) break;
    if (!isMeaningfulNote(item.title, item.body)) continue;
    const title = noteTitle(item.title, item.body);
    if (!title) continue;
    noteSources.push({
      type: "note",
      id: item.id,
      title,
      at: toIso(item.updatedAt),
      excerpt: noteExcerpt(item.body),
    });
  }

  return {
    sources: [...taskSources, ...noteSources],
    sourceTaskCount: taskSources.length,
    sourceNoteCount: noteSources.length,
  };
}

export async function draftWorkLogBody(
  env: Env,
  sources: DraftSource[],
): Promise<{ body: string; sources: WorkLogSource[] }> {
  const stored = toStoredSources(sources);
  if (sources.length === 0) {
    return { body: QUIET_DAY_BODY, sources: stored };
  }

  try {
    const result = await env.AI.run(WORK_LOG_MODEL, {
      messages: [
        { role: "system", content: WORK_LOG_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write today's status post from these sources only:\n${formatDraftPayload(sources)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 320,
    });

    const text = extractResponseText(result)
      .trim()
      .replace(/^```(?:markdown|md)?\s*/i, "")
      .replace(/```$/, "")
      .trim();

    if (!text) {
      return { body: fallbackBody(sources), sources: stored };
    }

    return { body: text, sources: stored };
  } catch {
    return { body: fallbackBody(sources), sources: stored };
  }
}
