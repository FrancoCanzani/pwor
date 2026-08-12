import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { resolveAutoSpace } from "../../../lib/auto-space";
import {
  dedentCode,
  normalizeVaultKind,
  parseCaptureInput,
  titleFromSnippet,
  titleFromText,
} from "../../../lib/vault-capture";
import {
  isCodeSnippetFile,
  languageFromFilename,
  languageFromMime,
} from "../../../lib/snippet-language";
import { inferLanguageFromContent } from "@shared/infer-language";
import { scheduleVaultEnrichment } from "../../../lib/vault-enrichment";
import {
  putVaultObject,
  vaultObjectByteSize,
} from "../../../lib/vault-storage";
import { vaultCategory, vaultItem } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
  /** When true, only items not filed into a space (the Inbox). */
  inbox: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional()
    .transform((value) => value === "1" || value === "true"),
});

const updateVaultItemSchema = z
  .object({
    workspaceId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    content: z.string().min(1).optional(),
    language: z.string().trim().min(1).max(40).nullable().optional(),
  })
  .refine(
    (value) =>
      value.workspaceId !== undefined ||
      value.categoryId !== undefined ||
      value.title !== undefined ||
      value.content !== undefined ||
      value.language !== undefined,
    { message: "At least one field is required" },
  );

const captureSchema = z.object({
  input: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  workspaceId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
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
  categoryId: z.string().nullable().optional(),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  workspaceId: z.string().nullable().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const categoriesQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

function serializeVaultItem<T extends { kind: string; previewR2Key?: string | null }>(
  item: T,
) {
  const { previewR2Key, ...rest } = item as T & {
    previewR2Key?: string | null;
  };
  return {
    ...rest,
    kind: normalizeVaultKind(item.kind),
    hasPreview: Boolean(previewR2Key),
  };
}

async function assertCategoryForWorkspace(
  db: ReturnType<typeof createDb>,
  categoryId: string,
  userId: string,
  workspaceId: string | null,
) {
  const [row] = await db
    .select({
      id: vaultCategory.id,
      workspaceId: vaultCategory.workspaceId,
    })
    .from(vaultCategory)
    .where(ownedBy(vaultCategory.id, categoryId, vaultCategory.userId, userId))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Category not found" });
  if ((row.workspaceId ?? null) !== (workspaceId ?? null)) {
    throw new HTTPException(400, { message: "Category workspace mismatch" });
  }
}

const app = new Hono<AppEnv>()
  .post("/", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.parseBody();
    const file = body.file;
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : null;
    const categoryId =
      typeof body.categoryId === "string" && body.categoryId.length > 0
        ? body.categoryId
        : null;
    const titleOverride =
      typeof body.title === "string" && body.title.trim().length > 0
        ? body.title.trim().slice(0, 200)
        : null;

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }

    const db = createDb(c.env.DB);
    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspaceId);
    }

    const id = crypto.randomUUID();
    const contentType = file.type || "application/octet-stream";

    if (isCodeSnippetFile(file.name, contentType)) {
      const content = dedentCode(await file.text());
      const language =
        languageFromFilename(file.name) ||
        languageFromMime(contentType) ||
        inferLanguageFromContent(content) ||
        null;

      await db.insert(vaultItem).values({
        id,
        userId: user.id,
        kind: "snippet",
        title: titleOverride ?? file.name,
        content,
        language,
        mimeType: contentType,
        workspaceId,
        categoryId,
        parseStatus: "pending",
      });

      scheduleVaultEnrichment(c.executionCtx, c.env, id);

      const [created] = await db
        .select()
        .from(vaultItem)
        .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
        .limit(1);

      return c.json(serializeVaultItem(created!), 201);
    }

    const r2Key = `${user.id}/${id}/${file.name}`;

    await putVaultObject(
      c.env.VAULT_BUCKET,
      r2Key,
      await file.arrayBuffer(),
      contentType,
    );

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      title: titleOverride ?? file.name,
      r2Key,
      mimeType: contentType,
      workspaceId,
      categoryId,
      parseStatus: "pending",
    });

    scheduleVaultEnrichment(c.executionCtx, c.env, id);

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(serializeVaultItem(created!), 201);
  })

  .post("/snippet", zValidator("json", createSnippetSchema), async (c) => {
    const user = c.get("user")!;
    const { content, title, language, workspaceId, categoryId } =
      c.req.valid("json");
    const db = createDb(c.env.DB);
    const workspace = workspaceId ?? null;
    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspace);
    }

    const id = crypto.randomUUID();
    const normalizedContent = dedentCode(content);
    const resolvedLanguage =
      language?.trim() ||
      inferLanguageFromContent(normalizedContent) ||
      null;
    const resolvedTitle =
      title?.trim() ||
      titleFromSnippet(normalizedContent, resolvedLanguage);

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      kind: "snippet",
      title: resolvedTitle,
      content: normalizedContent,
      language: resolvedLanguage,
      workspaceId: workspace,
      categoryId: categoryId ?? null,
      parseStatus: "pending",
    });

    scheduleVaultEnrichment(c.executionCtx, c.env, id);

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(serializeVaultItem(created!), 201);
  })

  .post("/capture", zValidator("json", captureSchema), async (c) => {
    const user = c.get("user")!;
    const {
      input,
      title,
      workspaceId,
      categoryId,
      autoSpace,
      hint,
      tags,
      preferredWorkspaceId,
    } = c.req.valid("json");
    const db = createDb(c.env.DB);

    let workspace = workspaceId ?? null;
    if (workspace == null && autoSpace) {
      workspace = await resolveAutoSpace(
        c.env,
        user.id,
        hint ?? input,
        preferredWorkspaceId,
      );
    }

    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspace);
    }

    const parsed = parseCaptureInput(input);
    const id = crypto.randomUUID();
    const seedTags = normalizeSeedTags(tags);

    if (parsed.type === "url") {
      await db.insert(vaultItem).values({
        id,
        userId: user.id,
        kind: "link",
        title: title || parsed.url,
        url: parsed.url,
        tags: seedTags,
        workspaceId: workspace,
        categoryId: categoryId ?? null,
        parseStatus: "pending",
      });
      scheduleVaultEnrichment(c.executionCtx, c.env, id);
    } else if (parsed.type === "snippet") {
      await db.insert(vaultItem).values({
        id,
        userId: user.id,
        kind: "snippet",
        title: titleFromSnippet(parsed.content, parsed.language),
        content: parsed.content,
        language: parsed.language,
        tags: seedTags,
        workspaceId: workspace,
        categoryId: categoryId ?? null,
        parseStatus: "pending",
      });
      scheduleVaultEnrichment(c.executionCtx, c.env, id);
    } else {
      await db.insert(vaultItem).values({
        id,
        userId: user.id,
        kind: "text",
        title: title || titleFromText(parsed.content),
        content: parsed.content,
        tags: seedTags,
        workspaceId: workspace,
        categoryId: categoryId ?? null,
        parseStatus: "pending",
      });
      scheduleVaultEnrichment(c.executionCtx, c.env, id);
    }

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(serializeVaultItem(created!), 201);
  })

  .get("/categories", zValidator("query", categoriesQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultCategory.userId, user.id)];
    if (workspaceId) {
      conditions.push(eq(vaultCategory.workspaceId, workspaceId));
    }

    const items = await db
      .select()
      .from(vaultCategory)
      .where(and(...conditions))
      .orderBy(asc(vaultCategory.position), asc(vaultCategory.createdAt));

    return c.json({ items });
  })

  .post("/categories", zValidator("json", createCategorySchema), async (c) => {
    const user = c.get("user")!;
    const { name, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    const existing = await db
      .select({ position: vaultCategory.position })
      .from(vaultCategory)
      .where(
        and(
          eq(vaultCategory.userId, user.id),
          workspaceId
            ? eq(vaultCategory.workspaceId, workspaceId)
            : isNull(vaultCategory.workspaceId),
        ),
      )
      .orderBy(desc(vaultCategory.position))
      .limit(1);

    const position = (existing[0]?.position ?? -1) + 1;

    await db.insert(vaultCategory).values({
      id,
      userId: user.id,
      name,
      workspaceId: workspaceId ?? null,
      position,
    });

    const [created] = await db
      .select()
      .from(vaultCategory)
      .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  })

  .patch(
    "/categories/:id",
    zValidator("json", updateCategorySchema),
    async (c) => {
      const user = c.get("user")!;
      const id = c.req.param("id");
      const { name } = c.req.valid("json");
      const db = createDb(c.env.DB);

      const [existing] = await db
        .select({ id: vaultCategory.id })
        .from(vaultCategory)
        .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id))
        .limit(1);

      if (!existing) {
        throw new HTTPException(404, { message: "Not found" });
      }

      await db
        .update(vaultCategory)
        .set({ name })
        .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id));

      const [updated] = await db
        .select()
        .from(vaultCategory)
        .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id))
        .limit(1);

      return c.json(updated);
    },
  )

  .delete("/categories/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: vaultCategory.id })
      .from(vaultCategory)
      .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Not found" });
    }

    await db
      .update(vaultItem)
      .set({ categoryId: null })
      .where(
        and(eq(vaultItem.userId, user.id), eq(vaultItem.categoryId, id)),
      );

    await db
      .delete(vaultCategory)
      .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id));

    return c.json({ id });
  })

  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, inbox } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultItem.userId, user.id)];
    if (inbox) {
      conditions.push(isNull(vaultItem.workspaceId));
    } else if (workspaceId) {
      conditions.push(eq(vaultItem.workspaceId, workspaceId));
    }

    const rows = await db
      .select()
      .from(vaultItem)
      .where(and(...conditions))
      .orderBy(desc(vaultItem.createdAt));

    const sizes = await Promise.all(
      rows.map(async (item) => {
        if (item.r2Key) {
          return vaultObjectByteSize(c.env.VAULT_BUCKET, item.r2Key);
        }
        if (item.content) {
          return new TextEncoder().encode(item.content).byteLength;
        }
        return 0;
      }),
    );
    const totalBytes = sizes.reduce((sum, size) => sum + size, 0);

    const items = rows.map((row, index) => ({
      ...serializeVaultItem(row),
      sizeBytes: sizes[index] ?? 0,
    }));

    return c.json({ items, totalBytes });
  })

  .patch("/:id", zValidator("json", updateVaultItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { workspaceId, categoryId, title, content, language } =
      c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({
        id: vaultItem.id,
        kind: vaultItem.kind,
        workspaceId: vaultItem.workspaceId,
      })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const kind = normalizeVaultKind(existing.kind);
    if (
      (content !== undefined || language !== undefined) &&
      kind !== "snippet" &&
      kind !== "text"
    ) {
      throw new HTTPException(400, {
        message: "content/language only supported for snippets and text",
      });
    }

    const nextWorkspaceId =
      workspaceId !== undefined ? workspaceId : existing.workspaceId;

    if (categoryId) {
      await assertCategoryForWorkspace(
        db,
        categoryId,
        user.id,
        nextWorkspaceId ?? null,
      );
    }

    const nextContent =
      content !== undefined && kind === "snippet"
        ? dedentCode(content)
        : content;

    await db
      .update(vaultItem)
      .set({
        ...(workspaceId !== undefined ? { workspaceId } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(nextContent !== undefined ? { content: nextContent } : {}),
        ...(language !== undefined ? { language } : {}),
      })
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id));

    const [updated] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(serializeVaultItem(updated!));
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    await db.delete(vaultItem).where(eq(vaultItem.id, id));
    if (item.r2Key) await c.env.VAULT_BUCKET.delete(item.r2Key);
    if (item.previewR2Key) await c.env.VAULT_BUCKET.delete(item.previewR2Key);

    return c.json({ id });
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!item) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const sizeBytes = item.r2Key
      ? await vaultObjectByteSize(c.env.VAULT_BUCKET, item.r2Key)
      : item.content
        ? new TextEncoder().encode(item.content).byteLength
        : 0;

    return c.json({ ...serializeVaultItem(item), sizeBytes });
  })

  .get("/:id/file", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!item || !item.r2Key || !item.mimeType) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const object = await c.env.VAULT_BUCKET.get(item.r2Key);
    if (!object) throw new HTTPException(404, { message: "File not found" });

    return new Response(object.body, {
      headers: { "Content-Type": item.mimeType },
    });
  })

  .get("/:id/preview", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select({
        id: vaultItem.id,
        previewR2Key: vaultItem.previewR2Key,
      })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!item?.previewR2Key) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const object = await c.env.VAULT_BUCKET.get(item.previewR2Key);
    if (!object) throw new HTTPException(404, { message: "Preview not found" });

    const contentType =
      object.httpMetadata?.contentType ||
      (item.previewR2Key.endsWith(".png") ? "image/png" : "image/jpeg");

    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });

export default app;
