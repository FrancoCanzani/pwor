import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { resolveAutoSpace } from "../../../lib/auto-space";
import { assertOwnedWorkspace } from "../../../lib/ownership";
import {
  dedentCode,
  normalizeItemKind,
  normalizeUrl,
  parseCaptureInput,
  titleFromSnippet,
  titleFromText,
} from "../../../lib/item-capture";
import {
  isCodeSnippetFile,
  languageFromFilename,
  languageFromMime,
} from "../../../lib/snippet-language";
import { inferLanguageFromContent } from "@shared/infer-language";
import { scheduleItemEnrichment } from "../../../lib/item-enrichment";
import { scheduleMissingSitePreview } from "../../../lib/item-screenshot";
import { putItemObject } from "../../../lib/item-storage";
import { item } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
  /** When true, only items not filed into a space (the Inbox). */
  inbox: z
    .union([
      z.literal("1"),
      z.literal("true"),
      z.literal("0"),
      z.literal("false"),
    ])
    .optional()
    .transform((value) => value === "1" || value === "true"),
  /** Opaque `${createdAtMs}_${id}` marker from the previous page. */
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const MAX_ITEM_FILE_BYTES = 50 * 1024 * 1024;
const MAX_POSTER_BYTES = 2 * 1024 * 1024;

function posterExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpg";
  return null;
}

function parseListCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const sep = cursor.indexOf("_");
  if (sep < 1) return null;
  const ms = Number(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (!Number.isFinite(ms) || !id) return null;
  return { createdAt: new Date(ms), id };
}

const updateItemSchema = z
  .object({
    workspaceId: z.string().nullable().optional(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    content: z.string().min(1).optional(),
    language: z.string().trim().min(1).max(40).nullable().optional(),
  })
  .refine(
    (value) =>
      value.workspaceId !== undefined ||
      value.title !== undefined ||
      value.content !== undefined ||
      value.language !== undefined,
    { message: "At least one field is required" },
  );

const captureSchema = z.object({
  input: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  workspaceId: z.string().nullable().optional(),
  /** When true and workspaceId omitted, pick a space from hint / preferences. */
  autoSpace: z.boolean().optional(),
  /** Extra text used for auto-space routing (e.g. tweet body). */
  hint: z.string().trim().max(4000).nullable().optional(),
  /** Seed tags merged with AI enrichment (e.g. x, bookmark). */
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  preferredWorkspaceId: z.string().nullable().optional(),
});

function normalizeSeedTags(tags: string[] | undefined): string[] | null {
  if (!tags?.length) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag.slice(0, 40));
    if (out.length >= 12) break;
  }
  return out.length ? out : null;
}

const createSnippetSchema = z.object({
  content: z.string().min(1),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  language: z.string().trim().min(1).max(40).nullable().optional(),
  workspaceId: z.string().nullable().optional(),
});

function itemSizeBytes(item: {
  sizeBytes: number | null;
  content: string | null;
}): number {
  if (item.sizeBytes != null) return item.sizeBytes;
  if (item.content) return new TextEncoder().encode(item.content).byteLength;
  return 0;
}

function serializeItem<
  T extends { kind: string; previewR2Key?: string | null },
>(item: T) {
  const { previewR2Key, ...rest } = item as T & {
    previewR2Key?: string | null;
  };
  return {
    ...rest,
    kind: normalizeItemKind(item.kind),
    hasPreview: Boolean(previewR2Key),
  };
}

const app = new Hono<AppEnv>()
  .post("/", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.parseBody();
    const file = body.file;
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : null;
    const titleOverride =
      typeof body.title === "string" && body.title.trim().length > 0
        ? body.title.trim().slice(0, 200)
        : null;

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }
    if (file.size === 0) {
      throw new HTTPException(400, { message: "file is empty" });
    }
    if (file.size > MAX_ITEM_FILE_BYTES) {
      throw new HTTPException(413, { message: "File too large (max 50MB)" });
    }

    const db = createDb(c.env.DB);
    await assertOwnedWorkspace(db, workspaceId, user.id);

    const id = crypto.randomUUID();
    const contentType = file.type || "application/octet-stream";

    if (isCodeSnippetFile(file.name, contentType)) {
      const content = dedentCode(await file.text());
      const language =
        languageFromFilename(file.name) ||
        languageFromMime(contentType) ||
        inferLanguageFromContent(content) ||
        null;

      await db.insert(item).values({
        id,
        userId: user.id,
        kind: "snippet",
        title: titleOverride ?? file.name,
        content,
        language,
        mimeType: contentType,
        workspaceId,
        parseStatus: "pending",
      });

      scheduleItemEnrichment(c.executionCtx, c.env, id);

      const [created] = await db
        .select()
        .from(item)
        .where(ownedBy(item.id, id, item.userId, user.id))
        .limit(1);

      return c.json(serializeItem(created!), 201);
    }

    const r2Key = `${user.id}/${id}/${file.name}`;

    const sizeBytes = await putItemObject(
      c.env.ITEMS_BUCKET,
      r2Key,
      await file.arrayBuffer(),
      contentType,
    );

    let previewR2Key: string | undefined;
    const poster = body.poster;
    if (
      contentType.startsWith("video/") &&
      poster instanceof File &&
      poster.size > 0 &&
      poster.size <= MAX_POSTER_BYTES
    ) {
      const ext = posterExtension(poster.type);
      if (ext) {
        previewR2Key = `${user.id}/${id}/preview.${ext}`;
        await putItemObject(
          c.env.ITEMS_BUCKET,
          previewR2Key,
          await poster.arrayBuffer(),
          poster.type,
        );
      }
    }

    await db.insert(item).values({
      id,
      userId: user.id,
      title: titleOverride ?? file.name,
      r2Key,
      sizeBytes,
      mimeType: contentType,
      workspaceId,
      parseStatus: "pending",
      ...(previewR2Key ? { previewR2Key } : {}),
    });

    scheduleItemEnrichment(c.executionCtx, c.env, id);

    const [created] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    return c.json(serializeItem(created!), 201);
  })

  .post("/snippet", zValidator("json", createSnippetSchema), async (c) => {
    const user = c.get("user")!;
    const { content, title, language, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const workspace = workspaceId ?? null;
    await assertOwnedWorkspace(db, workspace, user.id);

    const id = crypto.randomUUID();
    const normalizedContent = dedentCode(content);
    const resolvedLanguage =
      language?.trim() || inferLanguageFromContent(normalizedContent) || null;
    const resolvedTitle =
      title?.trim() || titleFromSnippet(normalizedContent, resolvedLanguage);

    await db.insert(item).values({
      id,
      userId: user.id,
      kind: "snippet",
      title: resolvedTitle,
      content: normalizedContent,
      language: resolvedLanguage,
      workspaceId: workspace,
      parseStatus: "pending",
    });

    scheduleItemEnrichment(c.executionCtx, c.env, id);

    const [created] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    return c.json(serializeItem(created!), 201);
  })

  .post("/capture", zValidator("json", captureSchema), async (c) => {
    const user = c.get("user")!;
    const { input, title, workspaceId, autoSpace, hint, tags, preferredWorkspaceId } =
      c.req.valid("json");
    const db = createDb(c.env.DB);

    let workspace = workspaceId ?? null;
    await assertOwnedWorkspace(db, workspace, user.id);
    if (workspace == null && autoSpace) {
      workspace = await resolveAutoSpace(
        c.env,
        user.id,
        hint ?? input,
        preferredWorkspaceId,
      );
    }

    const parsed = parseCaptureInput(input);
    const id = crypto.randomUUID();
    const seedTags = normalizeSeedTags(tags);

    if (parsed.type === "url") {
      const normalized = normalizeUrl(parsed.url);
      const [existing] = normalized
        ? await db
            .select()
            .from(item)
            .where(
              and(eq(item.userId, user.id), eq(item.normalizedUrl, normalized)),
            )
            .limit(1)
        : [];

      if (existing) {
        const mergedTags = seedTags
          ? Array.from(new Set([...(existing.tags ?? []), ...seedTags]))
          : existing.tags;
        const nextWorkspace =
          existing.workspaceId == null && workspace != null
            ? workspace
            : existing.workspaceId;

        if (mergedTags !== existing.tags || nextWorkspace !== existing.workspaceId) {
          await db
            .update(item)
            .set({ tags: mergedTags, workspaceId: nextWorkspace })
            .where(eq(item.id, existing.id));
        }

        const [merged] = await db
          .select()
          .from(item)
          .where(eq(item.id, existing.id))
          .limit(1);

        return c.json({ ...serializeItem(merged!), duplicate: true }, 200);
      }

      await db.insert(item).values({
        id,
        userId: user.id,
        kind: "link",
        title: title || parsed.url,
        url: parsed.url,
        normalizedUrl: normalized,
        tags: seedTags,
        workspaceId: workspace,
        parseStatus: "pending",
      });
      scheduleItemEnrichment(c.executionCtx, c.env, id);
    } else if (parsed.type === "snippet") {
      await db.insert(item).values({
        id,
        userId: user.id,
        kind: "snippet",
        title: titleFromSnippet(parsed.content, parsed.language),
        content: parsed.content,
        language: parsed.language,
        tags: seedTags,
        workspaceId: workspace,
        parseStatus: "pending",
      });
      scheduleItemEnrichment(c.executionCtx, c.env, id);
    } else {
      await db.insert(item).values({
        id,
        userId: user.id,
        kind: "text",
        title: title || titleFromText(parsed.content),
        content: parsed.content,
        tags: seedTags,
        workspaceId: workspace,
        parseStatus: "pending",
      });
      scheduleItemEnrichment(c.executionCtx, c.env, id);
    }

    const [created] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    return c.json(serializeItem(created!), 201);
  })

  .get("/usage", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, inbox } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(item.userId, user.id)];
    if (inbox) {
      conditions.push(isNull(item.workspaceId));
    } else if (workspaceId) {
      conditions.push(eq(item.workspaceId, workspaceId));
    }

    const [totals] = await db
      .select({
        totalBytes:
          sql<number>`coalesce(sum(coalesce(${item.sizeBytes}, length(cast(${item.content} as blob)), 0)), 0)`.mapWith(
            Number,
          ),
      })
      .from(item)
      .where(and(...conditions));

    return c.json({ totalBytes: totals?.totalBytes ?? 0 });
  })

  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, inbox, cursor, limit } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const baseConditions = [eq(item.userId, user.id)];
    if (inbox) {
      baseConditions.push(isNull(item.workspaceId));
    } else if (workspaceId) {
      baseConditions.push(eq(item.workspaceId, workspaceId));
    }

    const conditions = [...baseConditions];
    const parsedCursor = parseListCursor(cursor);
    if (parsedCursor) {
      conditions.push(
        or(
          lt(item.createdAt, parsedCursor.createdAt),
          and(
            eq(item.createdAt, parsedCursor.createdAt),
            lt(item.id, parsedCursor.id),
          ),
        )!,
      );
    }

    const [rows, [totals]] = await Promise.all([
      db
        .select()
        .from(item)
        .where(and(...conditions))
        .orderBy(desc(item.createdAt), desc(item.id))
        .limit(limit + 1),
      db
        .select({ total: count() })
        .from(item)
        .where(and(...baseConditions)),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    const items = page.map((row) => ({
      ...serializeItem(row),
      sizeBytes: itemSizeBytes(row),
    }));

    const missingPreview = page
      .filter(
        (row) =>
          normalizeItemKind(row.kind) === "link" &&
          Boolean(row.url) &&
          !row.previewR2Key,
      )
      .slice(0, 3);
    for (const row of missingPreview) {
      scheduleMissingSitePreview(c.executionCtx, c.env, row.id);
    }

    return c.json({
      items,
      total: totals?.total ?? items.length,
      nextCursor:
        hasMore && last ? `${last.createdAt.getTime()}_${last.id}` : null,
    });
  })

  .patch("/:id", zValidator("json", updateItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { workspaceId, title, content, language } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({
        id: item.id,
        kind: item.kind,
      })
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const kind = normalizeItemKind(existing.kind);
    if (
      (content !== undefined || language !== undefined) &&
      kind !== "snippet" &&
      kind !== "text"
    ) {
      throw new HTTPException(400, {
        message: "content/language only supported for snippets and text",
      });
    }

    if (workspaceId !== undefined) {
      await assertOwnedWorkspace(db, workspaceId, user.id);
    }

    const nextContent =
      content !== undefined && kind === "snippet"
        ? dedentCode(content)
        : content;

    await db
      .update(item)
      .set({
        ...(workspaceId !== undefined ? { workspaceId } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(nextContent !== undefined ? { content: nextContent } : {}),
        ...(language !== undefined ? { language } : {}),
      })
      .where(ownedBy(item.id, id, item.userId, user.id));

    const [updated] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    return c.json(serializeItem(updated!));
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Not found" });

    await db.delete(item).where(eq(item.id, id));
    if (row.r2Key) await c.env.ITEMS_BUCKET.delete(row.r2Key);
    if (row.previewR2Key) await c.env.ITEMS_BUCKET.delete(row.previewR2Key);

    return c.json({ id });
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row) {
      throw new HTTPException(404, { message: "Not found" });
    }

    if (
      normalizeItemKind(row.kind) === "link" &&
      row.url &&
      !row.previewR2Key
    ) {
      scheduleMissingSitePreview(c.executionCtx, c.env, row.id);
    }

    return c.json({
      ...serializeItem(row),
      sizeBytes: itemSizeBytes(row),
    });
  })

  .get("/:id/file", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row || !row.r2Key || !row.mimeType) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const object = await c.env.ITEMS_BUCKET.get(row.r2Key);
    if (!object) throw new HTTPException(404, { message: "File not found" });

    // Uploaded markup must never render on the app origin (stored XSS).
    const inlineSafe =
      /^(image|video|audio)\//.test(row.mimeType) ||
      row.mimeType === "application/pdf" ||
      row.mimeType === "text/plain";
    const filename = row.r2Key.slice(row.r2Key.lastIndexOf("/") + 1);

    return new Response(object.body, {
      headers: {
        "Content-Type": row.mimeType,
        ...(inlineSafe
          ? {}
          : {
              "Content-Disposition": `attachment; filename="${filename.replace(/["\\]/g, "_")}"`,
            }),
      },
    });
  })

  .get("/:id/preview", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select({
        id: item.id,
        previewR2Key: item.previewR2Key,
      })
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row?.previewR2Key) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const object = await c.env.ITEMS_BUCKET.get(row.previewR2Key);
    if (!object) throw new HTTPException(404, { message: "Preview not found" });

    const contentType =
      object.httpMetadata?.contentType ||
      (row.previewR2Key.endsWith(".png")
        ? "image/png"
        : row.previewR2Key.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");

    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });

export default app;
