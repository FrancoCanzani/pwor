import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { createDb } from "../../../db";
import { assertOwnedSpace } from "../../../db/helpers";
import { note, noteImage } from "../../../db/schema";
import { deleteEmbeddings, vectorId } from "../../../lib/embed";
import { deleteNoteImagesFromR2 } from "./cleanup";
import { serializeNote } from "./serialize";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function patchOwnedNotes(
  env: Env,
  userId: string,
  ids: string[],
  patch: { spaceId?: string | null; pinned?: boolean },
) {
  const unique = uniqueIds(ids);
  const db = createDb(env.DB);

  if (patch.spaceId !== undefined) {
    await assertOwnedSpace(db, patch.spaceId, userId);
  }

  const updated = await db
    .update(note)
    .set({
      ...(patch.spaceId !== undefined ? { spaceId: patch.spaceId } : {}),
      ...(patch.pinned !== undefined
        ? { pinnedAt: patch.pinned ? new Date() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(note.userId, userId), inArray(note.id, unique)))
    .returning();

  if (updated.length !== unique.length) {
    throw new HTTPException(404, { message: "Not found" });
  }

  return updated.map(serializeNote);
}

export async function deleteOwnedNotes(
  env: Env,
  userId: string,
  ids: string[],
) {
  const unique = uniqueIds(ids);
  const db = createDb(env.DB);

  const rows = await db
    .select({ id: note.id })
    .from(note)
    .where(and(eq(note.userId, userId), inArray(note.id, unique)));

  if (rows.length !== unique.length) {
    throw new HTTPException(404, { message: "Not found" });
  }

  const images = await db
    .select({ r2Key: noteImage.r2Key })
    .from(noteImage)
    .where(
      and(eq(noteImage.userId, userId), inArray(noteImage.noteId, unique)),
    );

  await deleteNoteImagesFromR2(env.ITEMS_BUCKET, images);
  await db
    .delete(note)
    .where(and(eq(note.userId, userId), inArray(note.id, unique)));
  await deleteEmbeddings(
    env,
    unique.map((id) => vectorId("note", id)),
  );

  return unique;
}
