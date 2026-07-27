import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { note, noteImage } from "../../../db/schema";
import type { AppEnv } from "../../../types";
import { deleteNoteImagesFromR2 } from "./cleanup";
import {
  isAllowedNoteImage,
  noteImageMarkdownUrl,
  noteImageR2Key,
} from "./images";

const createNoteSchema = z.object({
  body: z.string().optional().default(""),
  title: z.string().nullable().optional(),
});

const updateNoteSchema = z
  .object({
    body: z.string().optional(),
    title: z.string().nullable().optional(),
  })
  .refine(
    (value) => value.body !== undefined || value.title !== undefined,
    { message: "body or title is required" },
  );

function normalizeTitle(title: string | null | undefined) {
  if (title === undefined) return undefined;
  if (title === null) return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const app = new Hono<AppEnv>()
  .get("/", async (c) => {
    const user = c.get("user")!;
    const db = createDb(c.env.DB);

    const items = await db
      .select({
        id: note.id,
        title: note.title,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
      })
      .from(note)
      .where(eq(note.userId, user.id))
      .orderBy(desc(note.updatedAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createNoteSchema), async (c) => {
    const user = c.get("user")!;
    const { body, title } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    await db.insert(note).values({
      id,
      userId: user.id,
      body,
      title: normalizeTitle(title) ?? null,
    });

    const [created] = await db
      .select()
      .from(note)
      .where(and(eq(note.id, id), eq(note.userId, user.id)))
      .limit(1);

    return c.json(created, 201);
  })

  .get("/images/:imageId", async (c) => {
    const user = c.get("user")!;
    const imageId = c.req.param("imageId");
    const db = createDb(c.env.DB);

    const [image] = await db
      .select()
      .from(noteImage)
      .where(and(eq(noteImage.id, imageId), eq(noteImage.userId, user.id)))
      .limit(1);

    if (!image) throw new HTTPException(404, { message: "Not found" });

    const object = await c.env.VAULT_BUCKET.get(image.r2Key);
    if (!object) throw new HTTPException(404, { message: "File not found" });

    return new Response(object.body, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  })

  .post("/:id/images", async (c) => {
    const user = c.get("user")!;
    const noteId = c.req.param("id");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: note.id })
      .from(note)
      .where(and(eq(note.id, noteId), eq(note.userId, user.id)))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    const body = await c.req.parseBody();
    const file = body.file;

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }

    if (!isAllowedNoteImage(file)) {
      throw new HTTPException(400, {
        message: "Only PNG, JPEG, GIF, or WebP images up to 10MB are allowed",
      });
    }

    const imageId = crypto.randomUUID();
    const r2Key = noteImageR2Key({
      userId: user.id,
      noteId,
      imageId,
      mimeType: file.type,
    });

    await c.env.VAULT_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    await db.insert(noteImage).values({
      id: imageId,
      noteId,
      userId: user.id,
      r2Key,
      mimeType: file.type,
    });

    return c.json(
      {
        id: imageId,
        url: noteImageMarkdownUrl(imageId),
        mimeType: file.type,
      },
      201,
    );
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(note)
      .where(and(eq(note.id, id), eq(note.userId, user.id)))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    return c.json(item);
  })

  .patch("/:id", zValidator("json", updateNoteSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { body, title } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: note.id })
      .from(note)
      .where(and(eq(note.id, id), eq(note.userId, user.id)))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    const normalizedTitle = normalizeTitle(title);

    await db
      .update(note)
      .set({
        ...(body !== undefined ? { body } : {}),
        ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(note.id, id), eq(note.userId, user.id)));

    const [updated] = await db
      .select()
      .from(note)
      .where(and(eq(note.id, id), eq(note.userId, user.id)))
      .limit(1);

    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: note.id })
      .from(note)
      .where(and(eq(note.id, id), eq(note.userId, user.id)))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    const images = await db
      .select({ r2Key: noteImage.r2Key })
      .from(noteImage)
      .where(and(eq(noteImage.noteId, id), eq(noteImage.userId, user.id)));

    await deleteNoteImagesFromR2(c.env.VAULT_BUCKET, images);

    await db
      .delete(note)
      .where(and(eq(note.id, id), eq(note.userId, user.id)));

    return c.json({ ok: true });
  });

export default app;
