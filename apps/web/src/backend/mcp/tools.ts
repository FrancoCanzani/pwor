import { parseNoteDocument } from "@shared/note-frontmatter";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../db";
import { ownedBy } from "../db/helpers";
import { feed, feedItem, item } from "../db/schema";
import type { AppUser, WaitUntilCtx } from "../types";
import { createNote } from "../routes/notes/lib/create";
import { loadOwnedNote } from "../routes/notes/lib/load";
import { createNoteSchema } from "../routes/notes/schemas";
import { createCapturedItem } from "../routes/items/lib/create";
import { loadOwnedItem } from "../routes/items/lib/load";
import { captureSchema } from "../routes/items/schemas";
import { feedItemJoin, feedItemSelect } from "../routes/feeds/lib/item-select";
import { searchMemory } from "../routes/search/lib/run";
import { listOwnedSpaces } from "../routes/spaces/lib/load";

const MAX_TOOL_CHARS = 80_000;

export type McpContext = {
  env: Env;
  user: AppUser;
  ctx: WaitUntilCtx;
};

function clip(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= MAX_TOOL_CHARS) return value;
  return `${value.slice(0, MAX_TOOL_CHARS)}\n\n[truncated]`;
}

type ItemRecord = typeof item.$inferSelect;

export function mcpItem(row: ItemRecord, extra?: { duplicate?: boolean }) {
  return {
    kind: "item" as const,
    id: row.id,
    type: row.kind,
    title: row.title,
    summary: row.summary,
    tags: row.tags,
    url: row.url,
    siteName: row.siteName,
    mimeType: row.mimeType,
    spaceId: row.spaceId,
    parseStatus: row.parseStatus,
    createdAt: row.createdAt,
    text: clip(row.extractedMarkdown || row.content),
    ...(extra?.duplicate ? { duplicate: true as const } : {}),
  };
}

export const searchInput = z.object({
  q: z.string().trim().min(2).describe("What to look for"),
  spaceId: z
    .string()
    .optional()
    .describe("Only search this folder. Omit to search everything."),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function search(ctx: McpContext, args: z.infer<typeof searchInput>) {
  return searchMemory(ctx.env, {
    userId: ctx.user.id,
    q: args.q,
    spaceId: args.spaceId,
    limit: args.limit ?? 20,
  });
}

export const idInput = z.object({
  id: z.string().describe("The id from search"),
});

export async function getItem(ctx: McpContext, { id }: z.infer<typeof idInput>) {
  const row = await loadOwnedItem(createDb(ctx.env.DB), id, ctx.user.id);
  return mcpItem(row);
}

export async function getNote(ctx: McpContext, { id }: z.infer<typeof idInput>) {
  const row = await loadOwnedNote(createDb(ctx.env.DB), id, ctx.user.id);
  const parsed = parseNoteDocument(row.body);
  return {
    kind: "note" as const,
    id: row.id,
    title: row.title || parsed.title || null,
    spaceId: row.spaceId,
    itemId: row.itemId,
    feedItemId: row.feedItemId,
    updatedAt: row.updatedAt,
    text: clip(parsed.body),
  };
}

export async function getFeedItem(
  ctx: McpContext,
  { id }: z.infer<typeof idInput>,
) {
  const db = createDb(ctx.env.DB);
  const [row] = await db
    .select(feedItemSelect)
    .from(feedItem)
    .innerJoin(feed, feedItemJoin)
    .where(ownedBy(feedItem.id, id, feedItem.userId, ctx.user.id))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Not found" });

  return {
    kind: "feed" as const,
    id: row.id,
    feedId: row.feedId,
    title: row.title,
    url: row.url,
    author: row.author,
    summary: clip(row.summary),
    videoId: row.videoId,
    publishedAt: row.publishedAt,
    feedTitle: row.feedTitle,
    feedKind: row.feedKind,
    feedSiteUrl: row.feedSiteUrl,
  };
}

export async function listSpaces(ctx: McpContext) {
  const items = await listOwnedSpaces(createDb(ctx.env.DB), ctx.user.id);
  return items.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
  }));
}

export const captureInput = captureSchema.pick({
  input: true,
  title: true,
  spaceId: true,
  autoSpace: true,
});

export async function capture(
  ctx: McpContext,
  args: z.infer<typeof captureInput>,
) {
  const payload = captureSchema.parse(args);
  const { row, duplicate } = await createCapturedItem(
    ctx.env,
    ctx.ctx,
    ctx.user.id,
    payload,
  );
  return mcpItem(row, { duplicate });
}

export const createNoteInput = z.object({
  body: z.string().describe("The note, as plain text or markdown"),
  title: z.string().optional(),
  spaceId: z.string().optional(),
});

export async function createUserNote(
  ctx: McpContext,
  args: z.infer<typeof createNoteInput>,
) {
  const payload = createNoteSchema.parse({
    body: args.body,
    title: args.title,
    spaceId: args.spaceId,
  });
  const created = await createNote(ctx.env, ctx.ctx, ctx.user.id, payload);
  return {
    kind: "note" as const,
    id: created.id,
    title: created.title,
    spaceId: created.spaceId,
  };
}
