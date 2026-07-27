import { and, eq, lte } from "drizzle-orm";

import { createDb } from "../../../db";
import { note, noteImage } from "../../../db/schema";
import {
  NOTE_IMAGE_ORPHAN_GRACE_MS,
  noteImageMarkdownUrl,
} from "./images";

export async function deleteNoteImagesFromR2(
  bucket: R2Bucket,
  images: { r2Key: string }[],
): Promise<void> {
  if (images.length === 0) return;
  const keys = images.map((image) => image.r2Key);
  // R2 accepts up to 1000 keys per delete call.
  for (let i = 0; i < keys.length; i += 1000) {
    await bucket.delete(keys.slice(i, i + 1000));
  }
}

export async function cleanupOrphanNoteImages(env: Env): Promise<number> {
  const db = createDb(env.DB);
  const cutoff = new Date(Date.now() - NOTE_IMAGE_ORPHAN_GRACE_MS);

  const candidates = await db
    .select({
      id: noteImage.id,
      noteId: noteImage.noteId,
      r2Key: noteImage.r2Key,
    })
    .from(noteImage)
    .where(lte(noteImage.createdAt, cutoff));

  let deleted = 0;

  for (const image of candidates) {
    const [parent] = await db
      .select({ body: note.body })
      .from(note)
      .where(eq(note.id, image.noteId))
      .limit(1);

    const marker = noteImageMarkdownUrl(image.id);
    if (parent?.body.includes(marker)) continue;

    await env.VAULT_BUCKET.delete(image.r2Key);
    await db
      .delete(noteImage)
      .where(and(eq(noteImage.id, image.id)));
    deleted += 1;
  }

  if (deleted > 0) {
    console.log(`[notes] cleaned ${deleted} orphan note image(s)`);
  }

  return deleted;
}
