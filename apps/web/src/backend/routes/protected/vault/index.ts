import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { vaultItem } from "../../../db/schema";
import {
  extractUrl,
  fetchPageMetadata,
  titleFromText,
  vaultSearchText,
} from "../../../lib/vault-capture";
import { scheduleVaultEnrichment } from "../../../lib/vault-enrichment";
import {
  putVaultObject,
  vaultObjectByteSize,
} from "../../../lib/vault-storage";
import type { AppEnv } from "../../../types";
import categoriesRoutes, { assertCategoryOwned } from "./categories";

type VaultKind = "file" | "link" | "text";

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

const captureSchema = z.object({
  input: z.string().trim().min(1),
  workspaceId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

/** Legacy tweet/site rows still read as links. */
function normalizeKind(kind: string): VaultKind {
  if (kind === "file" || kind === "text") return kind;
  return "link";
}

function presentVaultItem<T extends { kind: string }>(item: T) {
  return { ...item, kind: normalizeKind(item.kind) };
}

async function insertVaultItem(
  db: ReturnType<typeof createDb>,
  values: typeof vaultItem.$inferInsert,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  userId: string,
) {
  const id = values.id;
  await db.insert(vaultItem).values(values);
  scheduleVaultEnrichment(ctx, env, id);

  const [created] = await db
    .select()
    .from(vaultItem)
    .where(ownedBy(vaultItem.id, id, vaultItem.userId, userId))
    .limit(1);

  return created ? presentVaultItem(created) : created;
}

const app = new Hono<AppEnv>()
  .route("/categories", categoriesRoutes)

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

    const created = await insertVaultItem(
      db,
      {
        id,
        userId: user.id,
        kind: "file",
        title: file.name,
        r2Key,
        mimeType: contentType,
        workspaceId,
        categoryId,
        searchText: vaultSearchText({ title: file.name }),
        parseStatus: "pending",
      },
      c.executionCtx,
      c.env,
      user.id,
    );

    return c.json(created, 201);
  })

  .post("/capture", zValidator("json", captureSchema), async (c) => {
    const user = c.get("user")!;
    const { input, workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    if (categoryId) await assertCategoryOwned(db, categoryId, user.id);

    const url = extractUrl(input);
    const id = crypto.randomUUID();

    let kind: VaultKind = "text";
    let title = titleFromText(input);
    let siteName: string | null = null;
    let content: string | null = input.trim();
    let summary: string | null = null;

    if (url) {
      kind = "link";
      const page = await fetchPageMetadata(url);
      title = page.title || url;
      siteName = page.siteName;
      summary = page.description;
      content =
        [page.description, page.text].filter(Boolean).join("\n\n") || null;
    }

    const created = await insertVaultItem(
      db,
      {
        id,
        userId: user.id,
        kind,
        title,
        summary,
        content,
        url,
        siteName,
        workspaceId: workspaceId ?? null,
        categoryId: categoryId ?? null,
        searchText: vaultSearchText({ title, summary, content }),
        parseStatus: "pending",
      },
      c.executionCtx,
      c.env,
      user.id,
    );

    return c.json(created, 201);
  })

  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, inboxItemId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultItem.userId, user.id)];
    if (workspaceId) conditions.push(eq(vaultItem.workspaceId, workspaceId));
    if (inboxItemId) conditions.push(eq(vaultItem.inboxItemId, inboxItemId));

    const rows = await db
      .select()
      .from(vaultItem)
      .where(and(...conditions))
      .orderBy(desc(vaultItem.createdAt));

    const items = rows.map(presentVaultItem);

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

    return c.json(updated ? presentVaultItem(updated) : updated);
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

    return c.json(presentVaultItem(item));
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
