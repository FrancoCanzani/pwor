import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import {
  normalizeVaultKind,
  parseCaptureInput,
  titleFromText,
} from "../../../lib/vault-capture";
import { scheduleVaultEnrichment } from "../../../lib/vault-enrichment";
import {
  putVaultObject,
  vaultObjectByteSize,
} from "../../../lib/vault-storage";
import { vaultCategory, vaultItem } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
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

function serializeVaultItem<T extends { kind: string }>(item: T) {
  return { ...item, kind: normalizeVaultKind(item.kind) };
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

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }

    const db = createDb(c.env.DB);
    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspaceId);
    }

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

    return c.json(serializeVaultItem(created!), 201);
  })

  .post("/capture", zValidator("json", captureSchema), async (c) => {
    const user = c.get("user")!;
    const { input, workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const workspace = workspaceId ?? null;
    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspace);
    }

    const parsed = parseCaptureInput(input);
    const id = crypto.randomUUID();

    if (parsed.type === "url") {
      await db.insert(vaultItem).values({
        id,
        userId: user.id,
        kind: "link",
        title: parsed.url,
        url: parsed.url,
        workspaceId: workspace,
        categoryId: categoryId ?? null,
        parseStatus: "pending",
      });
    } else {
      await db.insert(vaultItem).values({
        id,
        userId: user.id,
        kind: "text",
        title: titleFromText(parsed.content),
        content: parsed.content,
        workspaceId: workspace,
        categoryId: categoryId ?? null,
        parseStatus: "pending",
      });
    }

    scheduleVaultEnrichment(c.executionCtx, c.env, id);

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
    const { workspaceId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultItem.userId, user.id)];
    if (workspaceId) conditions.push(eq(vaultItem.workspaceId, workspaceId));

    const rows = await db
      .select()
      .from(vaultItem)
      .where(and(...conditions))
      .orderBy(desc(vaultItem.createdAt));

    const items = rows.map(serializeVaultItem);

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
    const totalBytes = sizes.reduce((sum, size) => sum + size, 0);

    return c.json({ items, totalBytes });
  })

  .patch("/:id", zValidator("json", updateVaultItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({
        id: vaultItem.id,
        workspaceId: vaultItem.workspaceId,
      })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Not found" });
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

    return c.json(serializeVaultItem(item));
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
