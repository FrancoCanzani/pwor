import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { vaultItem } from "../../../db/schema";
import type { AppEnv } from "../../../types";
import { domainOf, fetchLinkMetadata } from "./links";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
  inboxItemId: z.string().optional(),
});

const updateVaultItemSchema = z.object({
  workspaceId: z.string().nullable(),
});

const createLinkSchema = z.object({
  url: z.string().trim().url(),
  workspaceId: z.string().nullable().optional(),
});

const createTextSchema = z.object({
  content: z.string().trim().min(1),
  workspaceId: z.string().nullable().optional(),
});

const app = new Hono<AppEnv>()
  .post("/", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.parseBody();
    const file = body.file;
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : null;

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }

    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();
    const r2Key = `${user.id}/${id}/${file.name}`;

    await c.env.VAULT_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      title: file.name,
      r2Key,
      mimeType: file.type || "application/octet-stream",
      workspaceId,
    });

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  })

  .post("/links", zValidator("json", createLinkSchema), async (c) => {
    const user = c.get("user")!;
    const { url, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    const { title } = await fetchLinkMetadata(url);

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      kind: "link",
      title: title ?? domainOf(url),
      url,
      siteName: title,
      workspaceId: workspaceId ?? null,
    });

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  })

  .post("/text", zValidator("json", createTextSchema), async (c) => {
    const user = c.get("user")!;
    const { content, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    const title =
      content.length > 60 ? `${content.slice(0, 60).trim()}…` : content;

    await db.insert(vaultItem).values({
      id,
      userId: user.id,
      kind: "text",
      title,
      content,
      workspaceId: workspaceId ?? null,
    });

    const [created] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  })

  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, inboxItemId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultItem.userId, user.id)];
    if (workspaceId) conditions.push(eq(vaultItem.workspaceId, workspaceId));
    if (inboxItemId) conditions.push(eq(vaultItem.inboxItemId, inboxItemId));

    const items = await db
      .select()
      .from(vaultItem)
      .where(and(...conditions))
      .orderBy(desc(vaultItem.createdAt));

    return c.json({ items });
  })

  .patch("/:id", zValidator("json", updateVaultItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: vaultItem.id })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    await db
      .update(vaultItem)
      .set({ workspaceId })
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

    if (!item) throw new HTTPException(404, { message: "Not found" });

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
