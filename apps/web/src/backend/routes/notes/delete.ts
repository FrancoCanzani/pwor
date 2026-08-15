import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { note, noteImage } from "../../db/schema";
import type { AppEnv } from "../../types";
import { deleteNoteImagesFromR2 } from "./lib/cleanup";

export function registerDeleteNote(app: Hono<AppEnv>) {
  return app.delete("/:id", async (c) => {
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
}
