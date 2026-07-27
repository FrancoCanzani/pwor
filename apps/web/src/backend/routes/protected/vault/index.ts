import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { vaultItem } from "../../../db/schema";
import type { AppEnv } from "../../../types";
import { REMINDER_WINDOW_MS } from "./constants";
import { vaultDocumentTypeSchema } from "./schema";

const listQuerySchema = z.object({
  type: vaultDocumentTypeSchema.optional(),
});

const app = new Hono<AppEnv>()
  .post("/", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.parseBody();
    const file = body.file;

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
      status: "uploaded",
      title: file.name,
      r2Key,
      mimeType: file.type || "application/octet-stream",
    });

    await c.env.VAULT_QUEUE.send({ itemId: id });

    return c.json({ id, status: "uploaded" as const }, 201);
  })

  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { type } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultItem.userId, user.id)];
    if (type) conditions.push(eq(vaultItem.type, type));

    const items = await db
      .select()
      .from(vaultItem)
      .where(and(...conditions))
      .orderBy(desc(vaultItem.createdAt));

    return c.json({ items });
  })

  .get("/reminders", async (c) => {
    const user = c.get("user")!;
    const db = createDb(c.env.DB);

    const items = await db
      .select()
      .from(vaultItem)
      .where(and(eq(vaultItem.userId, user.id), eq(vaultItem.status, "ready")));

    const cutoff = Date.now() + REMINDER_WINDOW_MS;
    const needsAttention = items.filter(
      (item) => item.expiresAt !== null && item.expiresAt.getTime() <= cutoff,
    );

    return c.json({ items: needsAttention });
  })

  .post("/:id/retry", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(vaultItem)
      .where(and(eq(vaultItem.id, id), eq(vaultItem.userId, user.id)))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });
    if (item.status !== "failed") {
      throw new HTTPException(400, {
        message: "Only failed items can be retried",
      });
    }

    await db
      .update(vaultItem)
      .set({ status: "uploaded", error: null })
      .where(eq(vaultItem.id, id));

    await c.env.VAULT_QUEUE.send({ itemId: id });

    return c.json({ id, status: "uploaded" as const });
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(vaultItem)
      .where(and(eq(vaultItem.id, id), eq(vaultItem.userId, user.id)))
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
      .where(and(eq(vaultItem.id, id), eq(vaultItem.userId, user.id)))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    const object = await c.env.VAULT_BUCKET.get(item.r2Key);
    if (!object) throw new HTTPException(404, { message: "File not found" });

    return new Response(object.body, {
      headers: { "Content-Type": item.mimeType },
    });
  });

export default app;
