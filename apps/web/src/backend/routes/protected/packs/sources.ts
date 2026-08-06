import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { pack, packSource, source } from "../../../db/schema";
import { scheduleSourceMarkdownExtraction } from "../../../lib/source-markdown";
import {
  originalObjectKey,
  sha256Hex,
} from "../../../lib/source-storage";
import { putVaultObject } from "../../../lib/vault-storage";
import type { AppEnv } from "../../../types";

const createTextSchema = z.object({
  content: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
});

const createUrlSchema = z.object({
  url: z.string().url(),
  title: z.string().trim().min(1).optional(),
});

async function getOwnedPack(
  db: ReturnType<typeof createDb>,
  packId: string,
  userId: string,
) {
  const [row] = await db
    .select()
    .from(pack)
    .where(ownedBy(pack.id, packId, pack.userId, userId))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Pack not found" });
  return row;
}

async function bumpPack(db: ReturnType<typeof createDb>, packId: string) {
  const [row] = await db
    .select({ revision: pack.revision })
    .from(pack)
    .where(eq(pack.id, packId))
    .limit(1);
  await db
    .update(pack)
    .set({
      revision: (row?.revision ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(pack.id, packId));
}

async function linkAndBump(
  db: ReturnType<typeof createDb>,
  packId: string,
  sourceId: string,
) {
  await db
    .insert(packSource)
    .values({ packId, sourceId })
    .onConflictDoNothing();
  await bumpPack(db, packId);
}

const app = new Hono<AppEnv>()
  .get("/:packId/sources", async (c) => {
    const user = c.get("user")!;
    const packId = c.req.param("packId");
    const db = createDb(c.env.DB);
    await getOwnedPack(db, packId, user.id);

    const items = await db
      .select({
        id: source.id,
        type: source.type,
        title: source.title,
        filename: source.filename,
        mimeType: source.mimeType,
        size: source.size,
        hash: source.hash,
        sourceUrl: source.sourceUrl,
        parseStatus: source.parseStatus,
        parseError: source.parseError,
        parsedAt: source.parsedAt,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        addedAt: packSource.addedAt,
      })
      .from(packSource)
      .innerJoin(source, eq(packSource.sourceId, source.id))
      .where(and(eq(packSource.packId, packId), eq(source.userId, user.id)))
      .orderBy(desc(packSource.addedAt));

    return c.json({ items });
  })

  .get("/:packId/sources/:sourceId", async (c) => {
    const user = c.get("user")!;
    const packId = c.req.param("packId");
    const sourceId = c.req.param("sourceId");
    const db = createDb(c.env.DB);
    await getOwnedPack(db, packId, user.id);

    const [row] = await db
      .select({
        id: source.id,
        type: source.type,
        title: source.title,
        filename: source.filename,
        mimeType: source.mimeType,
        size: source.size,
        hash: source.hash,
        sourceUrl: source.sourceUrl,
        content: source.content,
        extractedMarkdown: source.extractedMarkdown,
        parseStatus: source.parseStatus,
        parseError: source.parseError,
        parsedAt: source.parsedAt,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        addedAt: packSource.addedAt,
      })
      .from(packSource)
      .innerJoin(source, eq(packSource.sourceId, source.id))
      .where(
        and(
          eq(packSource.packId, packId),
          eq(packSource.sourceId, sourceId),
          eq(source.userId, user.id),
        ),
      )
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Not found" });
    return c.json(row);
  })

  .get("/:packId/sources/:sourceId/original", async (c) => {
    const user = c.get("user")!;
    const packId = c.req.param("packId");
    const sourceId = c.req.param("sourceId");
    const db = createDb(c.env.DB);
    await getOwnedPack(db, packId, user.id);

    const [row] = await db
      .select({
        r2Key: source.r2Key,
        mimeType: source.mimeType,
        filename: source.filename,
        title: source.title,
        userId: source.userId,
      })
      .from(packSource)
      .innerJoin(source, eq(packSource.sourceId, source.id))
      .where(
        and(
          eq(packSource.packId, packId),
          eq(packSource.sourceId, sourceId),
          eq(source.userId, user.id),
        ),
      )
      .limit(1);

    if (!row?.r2Key) {
      throw new HTTPException(404, { message: "Original not found" });
    }

    const object = await c.env.VAULT_BUCKET.get(row.r2Key);
    if (!object) {
      throw new HTTPException(404, { message: "Original missing from storage" });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      row.mimeType || object.httpMetadata?.contentType || "application/octet-stream",
    );
    headers.set("Cache-Control", "private, max-age=3600");
    const filename = row.filename || row.title;
    if (filename) {
      headers.set(
        "Content-Disposition",
        `inline; filename="${filename.replace(/"/g, "")}"`,
      );
    }

    return new Response(object.body, { headers });
  })

  .post("/:packId/sources", async (c) => {
    const user = c.get("user")!;
    const packId = c.req.param("packId");
    const db = createDb(c.env.DB);
    await getOwnedPack(db, packId, user.id);

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }

    const buffer = await file.arrayBuffer();
    const hash = await sha256Hex(buffer);
    const r2Key = originalObjectKey(hash);
    const mimeType = file.type || "application/octet-stream";
    const title = file.name;

    const existing = await db
      .select()
      .from(source)
      .where(and(eq(source.userId, user.id), eq(source.hash, hash)))
      .limit(1);

    let item = existing[0];

    if (!item) {
      const head = await c.env.VAULT_BUCKET.head(r2Key);
      if (!head) {
        await putVaultObject(c.env.VAULT_BUCKET, r2Key, buffer, mimeType);
      }

      const id = crypto.randomUUID();
      const [created] = await db
        .insert(source)
        .values({
          id,
          userId: user.id,
          type: "file",
          title,
          filename: file.name,
          mimeType,
          size: buffer.byteLength,
          hash,
          r2Key,
          parseStatus: "pending",
        })
        .returning();
      if (!created) {
        throw new HTTPException(500, { message: "Failed to create source" });
      }
      item = created;
      scheduleSourceMarkdownExtraction(c.executionCtx, c.env, id);
    } else if (item.parseStatus !== "ready") {
      scheduleSourceMarkdownExtraction(c.executionCtx, c.env, item.id);
    }

    await linkAndBump(db, packId, item.id);
    return c.json(item, 201);
  })

  .post(
    "/:packId/sources/text",
    zValidator("json", createTextSchema),
    async (c) => {
      const user = c.get("user")!;
      const packId = c.req.param("packId");
      const { content, title } = c.req.valid("json");
      const db = createDb(c.env.DB);
      await getOwnedPack(db, packId, user.id);

      const id = crypto.randomUUID();
      const [created] = await db
        .insert(source)
        .values({
          id,
          userId: user.id,
          type: "text",
          title: title ?? content.slice(0, 80),
          content,
          extractedMarkdown: content,
          parseStatus: "ready",
          parsedAt: new Date(),
          size: new TextEncoder().encode(content).byteLength,
        })
        .returning();

      await linkAndBump(db, packId, id);
      return c.json(created, 201);
    },
  )

  .post(
    "/:packId/sources/url",
    zValidator("json", createUrlSchema),
    async (c) => {
      const user = c.get("user")!;
      const packId = c.req.param("packId");
      const { url, title } = c.req.valid("json");
      const db = createDb(c.env.DB);
      await getOwnedPack(db, packId, user.id);

      let response: Response;
      try {
        response = await fetch(url, {
          redirect: "follow",
          headers: {
            Accept:
              "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
            "User-Agent": "PworBot/1.0",
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "fetch failed";
        throw new HTTPException(400, { message });
      }

      if (!response.ok) {
        throw new HTTPException(400, {
          message: `Could not fetch URL (${response.status})`,
        });
      }

      const contentType =
        response.headers.get("content-type")?.split(";")[0]?.trim() ||
        "text/html";
      const buffer = await response.arrayBuffer();
      const hash = await sha256Hex(buffer);
      const r2Key = originalObjectKey(hash);

      const existing = await db
        .select()
        .from(source)
        .where(and(eq(source.userId, user.id), eq(source.hash, hash)))
        .limit(1);

      let item = existing[0];

      if (!item) {
        const head = await c.env.VAULT_BUCKET.head(r2Key);
        if (!head) {
          await putVaultObject(c.env.VAULT_BUCKET, r2Key, buffer, contentType);
        }

        const hostname = (() => {
          try {
            return new URL(url).hostname;
          } catch {
            return null;
          }
        })();

        const id = crypto.randomUUID();
        const [created] = await db
          .insert(source)
          .values({
            id,
            userId: user.id,
            type: "url",
            title: title ?? hostname ?? url,
            filename: hostname ? `${hostname}.html` : "page.html",
            mimeType: contentType,
            size: buffer.byteLength,
            hash,
            r2Key,
            sourceUrl: url,
            parseStatus: "pending",
          })
          .returning();
        if (!created) {
          throw new HTTPException(500, { message: "Failed to create source" });
        }
        item = created;
        scheduleSourceMarkdownExtraction(c.executionCtx, c.env, id);
      } else if (item.parseStatus !== "ready") {
        scheduleSourceMarkdownExtraction(c.executionCtx, c.env, item.id);
      }

      await linkAndBump(db, packId, item.id);
      return c.json(item, 201);
    },
  )

  .delete("/:packId/sources/:sourceId", async (c) => {
    const user = c.get("user")!;
    const packId = c.req.param("packId");
    const sourceId = c.req.param("sourceId");
    const db = createDb(c.env.DB);
    await getOwnedPack(db, packId, user.id);

    const removed = await db
      .delete(packSource)
      .where(
        and(eq(packSource.packId, packId), eq(packSource.sourceId, sourceId)),
      )
      .returning({ sourceId: packSource.sourceId });

    if (removed.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    await bumpPack(db, packId);

    const remaining = await db
      .select({ packId: packSource.packId })
      .from(packSource)
      .where(eq(packSource.sourceId, sourceId))
      .limit(1);

    if (remaining.length === 0) {
      await db
        .delete(source)
        .where(ownedBy(source.id, sourceId, source.userId, user.id));
    }

    return c.json({ ok: true });
  });

export default app;
