import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { createDb } from "../../../db";
import { assertOwnedSpace } from "../../../db/helpers";
import { item } from "../../../db/schema";
import { deleteEmbeddings, vectorId } from "../../../lib/embed";
import { deleteNotesForItems } from "../../notes/lib/cleanup";
import { serializeItem } from "./serialize";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function patchOwnedItems(
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
    .update(item)
    .set({
      ...(patch.spaceId !== undefined ? { spaceId: patch.spaceId } : {}),
      ...(patch.pinned !== undefined
        ? { pinnedAt: patch.pinned ? new Date() : null }
        : {}),
    })
    .where(and(eq(item.userId, userId), inArray(item.id, unique)))
    .returning();

  if (updated.length !== unique.length) {
    throw new HTTPException(404, { message: "Not found" });
  }

  return updated.map(serializeItem);
}

export async function deleteOwnedItems(
  env: Env,
  userId: string,
  ids: string[],
) {
  const unique = uniqueIds(ids);
  const db = createDb(env.DB);

  const rows = await db
    .select({
      id: item.id,
      r2Key: item.r2Key,
      previewR2Key: item.previewR2Key,
    })
    .from(item)
    .where(and(eq(item.userId, userId), inArray(item.id, unique)));

  if (rows.length !== unique.length) {
    throw new HTTPException(404, { message: "Not found" });
  }

  await deleteNotesForItems(
    db,
    env,
    rows.map((row) => row.id),
  );
  await db
    .delete(item)
    .where(and(eq(item.userId, userId), inArray(item.id, unique)));
  await deleteEmbeddings(
    env,
    rows.map((row) => vectorId("item", row.id)),
  );

  const keys = rows.flatMap((row) =>
    [row.r2Key, row.previewR2Key].filter((key): key is string => Boolean(key)),
  );
  await Promise.all(keys.map((key) => env.ITEMS_BUCKET.delete(key)));

  return unique;
}
