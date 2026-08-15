import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { note, noteImage } from "../../../db/schema";
import {
  assertOwnedFeedItem,
  assertOwnedItem,
  assertOwnedWorkspace,
} from "../../../lib/ownership";
import type { AppEnv } from "../../../types";
import {
  EMPTY_NOTE_BODY,
  inferTitleFromRaw,
  normalizeNoteTitle,
} from "@shared/note-frontmatter";
import { toEpochMs } from "@shared/time";
import { deleteNoteImagesFromR2 } from "./cleanup";
import {
  isAllowedNoteImage,
  noteImageMarkdownUrl,
  noteImageR2Key,
} from "./images";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
  itemId: z.string().optional(),
  feedItemId: z.string().optional(),
});

const anchorSchema = z.object({
  from: z.number().int(),
  to: z.number().int(),
  quote: z.string().min(1).max(6000),
  prefix: z.string().max(200),
  suffix: z.string().max(200),
  patch: z.string(),
});

const createNoteSchema = z.object({
  body: z.string().optional().default(""),
  title: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  feedItemId: z.string().nullable().optional(),
  color: z.string().trim().min(1).max(20).nullable().optional(),
  anchor: anchorSchema.optional(),
});

const updateNoteSchema = z
  .object({
    body: z.string().optional(),
    title: z.string().nullable().optional(),
    workspaceId: z.string().nullable().optional(),
    color: z.string().trim().min(1).max(20).nullable().optional(),
    expectedUpdatedAt: z.union([z.string(), z.number()]).optional(),
  })
  .refine(
    (value) =>
      value.body !== undefined ||
      value.title !== undefined ||
      value.workspaceId !== undefined ||
      value.color !== undefined,
    { message: "body, title, workspaceId, or color is required" },
  )
  .refine(
    (value) => {
      const touchesContent =
        value.body !== undefined ||
        value.title !== undefined ||
        value.color !== undefined;
      return !touchesContent || value.expectedUpdatedAt !== undefined;
    },
    {
      message:
        "expectedUpdatedAt is required when updating body, title, or color",
    },
  );

function normalizeTitle(title: string | null | undefined) {
  if (title === undefined) return undefined;
  return normalizeNoteTitle(title);
}

function titleFromBody(body: string): string | null {
  return normalizeNoteTitle(inferTitleFromRaw(body).title);
}

const app = new Hono<AppEnv>()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, itemId, feedItemId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(note.userId, user.id)];
    if (workspaceId) conditions.push(eq(note.workspaceId, workspaceId));
    if (itemId) conditions.push(eq(note.itemId, itemId));
    if (feedItemId) conditions.push(eq(note.feedItemId, feedItemId));

    const anchored = Boolean(itemId || feedItemId);
    const items = await db
      .select({
        id: note.id,
        title: note.title,
        workspaceId: note.workspaceId,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
        ...(anchored
          ? {
              itemId: note.itemId,
              feedItemId: note.feedItemId,
              color: note.color,
              anchorFrom: note.anchorFrom,
              anchorTo: note.anchorTo,
              anchorQuote: note.anchorQuote,
              anchorPrefix: note.anchorPrefix,
              anchorSuffix: note.anchorSuffix,
              anchorPatch: note.anchorPatch,
            }
          : {}),
      })
      .from(note)
      .where(and(...conditions))
      .orderBy(desc(note.updatedAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createNoteSchema), async (c) => {
    const user = c.get("user")!;
    const payload = c.req.valid("json");
    const db = createDb(c.env.DB);

    await assertOwnedWorkspace(db, payload.workspaceId, user.id);
    await assertOwnedItem(db, payload.itemId, user.id);
    await assertOwnedFeedItem(db, payload.feedItemId, user.id);

    const id = crypto.randomUUID();
    const body =
      payload.body.trim().length > 0 ? payload.body : EMPTY_NOTE_BODY;
    const title = normalizeTitle(payload.title) ?? titleFromBody(body) ?? null;

    const [created] = await db
      .insert(note)
      .values({
        id,
        userId: user.id,
        body,
        title,
        workspaceId: payload.workspaceId ?? null,
        itemId: payload.itemId ?? null,
        feedItemId: payload.feedItemId ?? null,
        color: payload.color ?? null,
        ...(payload.anchor
          ? {
              anchorFrom: payload.anchor.from,
              anchorTo: payload.anchor.to,
              anchorQuote: payload.anchor.quote,
              anchorPrefix: payload.anchor.prefix,
              anchorSuffix: payload.anchor.suffix,
              anchorPatch: payload.anchor.patch,
            }
          : {}),
      })
      .returning();

    return c.json(created, 201);
  })

  .get("/images/:imageId", async (c) => {
    const user = c.get("user")!;
    const imageId = c.req.param("imageId");
    const db = createDb(c.env.DB);

    const [image] = await db
      .select()
      .from(noteImage)
      .where(ownedBy(noteImage.id, imageId, noteImage.userId, user.id))
      .limit(1);

    if (!image) throw new HTTPException(404, { message: "Not found" });

    const object = await c.env.ITEMS_BUCKET.get(image.r2Key);
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
      .where(ownedBy(note.id, noteId, note.userId, user.id))
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

    await c.env.ITEMS_BUCKET.put(r2Key, file.stream(), {
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
      .where(ownedBy(note.id, id, note.userId, user.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    return c.json(item);
  })

  .patch("/:id", zValidator("json", updateNoteSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { body, title, workspaceId, color, expectedUpdatedAt } =
      c.req.valid("json");
    const db = createDb(c.env.DB);

    await assertOwnedWorkspace(db, workspaceId, user.id);

    const normalizedTitle =
      body !== undefined
        ? (normalizeTitle(title) ?? titleFromBody(body))
        : normalizeTitle(title);
    const patch = {
      ...(body !== undefined ? { body } : {}),
      ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
      ...(workspaceId !== undefined ? { workspaceId } : {}),
      ...(color !== undefined ? { color } : {}),
      updatedAt: new Date(),
    };

    const touchesContent =
      body !== undefined || title !== undefined || color !== undefined;
    if (touchesContent) {
      // Single-statement compare-and-swap on updatedAt; no read-write race.
      const expectedMs = toEpochMs(expectedUpdatedAt!);
      if (Number.isNaN(expectedMs)) {
        throw new HTTPException(400, { message: "Invalid expectedUpdatedAt" });
      }

      const [updated] = await db
        .update(note)
        .set(patch)
        .where(
          and(
            ownedBy(note.id, id, note.userId, user.id),
            eq(note.updatedAt, new Date(expectedMs)),
          ),
        )
        .returning();

      if (updated) return c.json(updated);

      const [existing] = await db
        .select()
        .from(note)
        .where(ownedBy(note.id, id, note.userId, user.id))
        .limit(1);
      if (!existing) throw new HTTPException(404, { message: "Not found" });
      return c.json({ error: "conflict", note: existing }, 409);
    }

    const [updated] = await db
      .update(note)
      .set(patch)
      .where(ownedBy(note.id, id, note.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });

    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: note.id })
      .from(note)
      .where(ownedBy(note.id, id, note.userId, user.id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    const images = await db
      .select({ r2Key: noteImage.r2Key })
      .from(noteImage)
      .where(ownedBy(noteImage.noteId, id, noteImage.userId, user.id));

    await deleteNoteImagesFromR2(c.env.ITEMS_BUCKET, images);

    await db.delete(note).where(ownedBy(note.id, id, note.userId, user.id));

    return c.json({ ok: true });
  });

export default app;
