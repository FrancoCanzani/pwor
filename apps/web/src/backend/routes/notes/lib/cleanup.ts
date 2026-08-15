import { eq, inArray, lte } from "drizzle-orm";

import { createDb, type Db } from "../../../db";
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

export async function deleteNotesForItem(
  db: Db,
  bucket: R2Bucket,
  itemId: string,
): Promise<void> {
  const notes = await db
    .select({ id: note.id })
    .from(note)
    .where(eq(note.itemId, itemId));
  if (notes.length === 0) return;

  const images = await db
    .select({ r2Key: noteImage.r2Key })
    .from(noteImage)
    .where(
      inArray(
        noteImage.noteId,
        notes.map((row) => row.id),
      ),
    );
  await deleteNoteImagesFromR2(bucket, images);
  await db.delete(note).where(eq(note.itemId, itemId));
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

  if (candidates.length === 0) return 0;

  const noteIds = [...new Set(candidates.map((image) => image.noteId))];
  const parents = await db
    .select({ id: note.id, body: note.body })
    .from(note)
    .where(inArray(note.id, noteIds));
  const bodyByNoteId = new Map(
    parents.map((parent) => [parent.id, parent.body]),
  );

  const orphans = candidates.filter((image) => {
    const body = bodyByNoteId.get(image.noteId);
    return !body?.includes(noteImageMarkdownUrl(image.id));
  });

  if (orphans.length > 0) {
    await deleteNoteImagesFromR2(env.ITEMS_BUCKET, orphans);
    await db.delete(noteImage).where(
      inArray(
        noteImage.id,
        orphans.map((image) => image.id),
      ),
    );
    console.log(`[notes] cleaned ${orphans.length} orphan note image(s)`);
  }

  return orphans.length;
}
