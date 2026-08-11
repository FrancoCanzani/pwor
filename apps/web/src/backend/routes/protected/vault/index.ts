import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import {
  detectCaptureKind,
  extractUrl,
  fetchPageMetadata,
  titleFromText,
} from "../../../lib/vault-capture";
import { scheduleVaultEnrichment } from "../../../lib/vault-enrichment";
import {
  putVaultObject,
  vaultObjectByteSize,
} from "../../../lib/vault-storage";
import { vaultCategory, vaultItem } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const ACTIVE_KINDS = ["file", "link", "text", "tweet", "site"] as const;

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
  inboxItemId: z.string().optional(),
});

const updateVaultItemSchema = z
  .object({
    workspaceId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
  })
  .refine(
    (value) => value.workspaceId !== undefined || value.categoryId !== undefined,
    { message: "workspaceId or categoryId is required" },
  );

const createTextSchema = z.object({
  content: z.string().trim().min(1),
  workspaceId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

const captureSchema = z.object({
  input: z.string().trim().min(1),
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

async function assertCategoryOwned(
  db: ReturnType<typeof createDb>,
  categoryId: string,
  userId: string,
) {
  const [row] = await db
    .select({ id: vaultCategory.id })
    .from(vaultCategory)
    .where(ownedBy(vaultCategory.id, categoryId, vaultCategory.userId, userId))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Category not found" });
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

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }

    const db = createDb(c.env.DB);
    if (categoryId) await assertCategoryOwned(db, categoryId, user.id);

    const id = crypto.randomUUID();
    const r2Key = `${user.id}/${id}/${file.name}`;
    const contentType = file.type || "application/octet-stream";

    await putVaultObject(
      c.env.VAULT_BUCKET,
      r2Key,
      await file.arrayBuffer(),
      contentType,
    );

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      title: file.name,
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

    return c.json(created, 201);
  })

  .post("/text", zValidator("json", createTextSchema), async (c) => {
    const user = c.get("user")!;
    const { content, workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    if (categoryId) await assertCategoryOwned(db, categoryId, user.id);

    const id = crypto.randomUUID();
    const title = titleFromText(content);

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      kind: "text",
      title,
      content,
      workspaceId: workspaceId ?? null,
      categoryId: categoryId ?? null,
      parseStatus: "pending",
    });

    scheduleVaultEnrichment(c.executionCtx, c.env, id);

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  })

  .post("/capture", zValidator("json", captureSchema), async (c) => {
    const user = c.get("user")!;
    const { input, workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    if (categoryId) await assertCategoryOwned(db, categoryId, user.id);

    const kind = detectCaptureKind(input);
    const url = extractUrl(input);
    const id = crypto.randomUUID();

    let title = titleFromText(input);
    let siteName: string | null = null;
    let content: string | null = kind === "text" ? input.trim() : null;
    let summary: string | null = null;
    let resolvedKind = kind;

    if (url && kind !== "text") {
      const page = await fetchPageMetadata(url);
      title = page.title || url;
      siteName = page.siteName;
      summary = page.description;
      content = [page.description, page.text].filter(Boolean).join("\n\n") || null;
      resolvedKind = "site";
    }

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      kind: resolvedKind,
      title,
      summary,
      content,
      url,
      siteName,
      workspaceId: workspaceId ?? null,
      categoryId: categoryId ?? null,
      parseStatus: "pending",
    });

    scheduleVaultEnrichment(c.executionCtx, c.env, id);

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(created, 201);
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
    const { workspaceId, inboxItemId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [
      eq(vaultItem.userId, user.id),
      inArray(vaultItem.kind, [...ACTIVE_KINDS]),
    ];
    if (workspaceId) conditions.push(eq(vaultItem.workspaceId, workspaceId));
    if (inboxItemId) conditions.push(eq(vaultItem.inboxItemId, inboxItemId));

    const items = await db
      .select()
      .from(vaultItem)
      .where(and(...conditions))
      .orderBy(desc(vaultItem.createdAt));

    let totalBytes = 0;
    if (!inboxItemId) {
      const sizes = await Promise.all(
        items.map(async (item) => {
          if (item.r2Key) {
            return vaultObjectByteSize(c.env.VAULT_BUCKET, item.r2Key);
          }
          if (item.content) {
            return new TextEncoder().encode(item.content).byteLength;
          }
          return 0;
        }),
      );
      totalBytes = sizes.reduce((sum, size) => sum + size, 0);
    }

    return c.json({ items, totalBytes });
  })

  .patch("/:id", zValidator("json", updateVaultItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: vaultItem.id })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Not found" });
    }

    if (categoryId) await assertCategoryOwned(db, categoryId, user.id);

    await db
      .update(vaultItem)
      .set({
        ...(workspaceId !== undefined ? { workspaceId } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
      })
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id));

    const [updated] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(updated);
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

    return c.json(item);
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
  });

export default app;
