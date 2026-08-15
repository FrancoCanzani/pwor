import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { note, noteImage } from "../../db/schema";
import type { AppEnv } from "../../types";
import {
  isAllowedNoteImage,
  noteImageMarkdownUrl,
  noteImageR2Key,
} from "./lib/images";

export function registerPostNoteImage(app: Hono<AppEnv>) {
  return app.post("/:id/images", async (c) => {
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
  });
}
