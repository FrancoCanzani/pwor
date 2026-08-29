import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { createDb } from "../../../db";
import { assertOwnedSpace } from "../../../db/helpers";
import { item } from "../../../db/schema";
import { deleteEmbeddings, vectorId } from "../../../lib/embed";
import type { WaitUntilCtx } from "../../../types";
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
  ctx: WaitUntilCtx,
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

  if (rows.length === 0) return [];

  const foundIds = rows.map((row) => row.id);

  await deleteNotesForItems(db, env, foundIds);
  await db
    .delete(item)
    .where(and(eq(item.userId, userId), inArray(item.id, foundIds)));

  const keys = rows.flatMap((row) =>
    [row.r2Key, row.previewR2Key].filter((key): key is string => Boolean(key)),
  );
  ctx.waitUntil(
    Promise.all([
      deleteEmbeddings(
        env,
        foundIds.map((id) => vectorId("item", id)),
      ),
      ...keys.map((key) => env.ITEMS_BUCKET.delete(key)),
    ]),
  );

  return foundIds;
}
