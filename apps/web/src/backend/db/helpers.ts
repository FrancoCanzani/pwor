import { and, eq, type AnyColumn } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { Db } from "./index";
import { feedItem, item, space } from "./schema";

export function ownedBy(
  idColumn: AnyColumn,
  id: string,
  userIdColumn: AnyColumn,
  userId: string,
) {
  return and(eq(idColumn, id), eq(userIdColumn, userId));
}

export async function assertOwnedSpace(
  db: Db,
  spaceId: string | null | undefined,
  userId: string,
): Promise<void> {
  if (spaceId == null) return;
  const [row] = await db
    .select({ id: space.id })
    .from(space)
    .where(ownedBy(space.id, spaceId, space.userId, userId))
    .limit(1);
  if (!row) {
    throw new HTTPException(400, { message: "Invalid space" });
  }
}

export async function assertOwnedItem(
  db: Db,
  itemId: string | null | undefined,
  userId: string,
): Promise<{ id: string; spaceId: string | null } | null> {
  if (itemId == null) return null;
  const [row] = await db
    .select({ id: item.id, spaceId: item.spaceId })
    .from(item)
    .where(ownedBy(item.id, itemId, item.userId, userId))
    .limit(1);
  if (!row) {
    throw new HTTPException(400, { message: "Invalid item" });
  }
  return row;
}

export async function assertOwnedFeedItem(
  db: Db,
  feedItemId: string | null | undefined,
  userId: string,
): Promise<{ id: string } | null> {
  if (feedItemId == null) return null;
  const [row] = await db
    .select({ id: feedItem.id })
    .from(feedItem)
    .where(ownedBy(feedItem.id, feedItemId, feedItem.userId, userId))
    .limit(1);
  if (!row) {
    throw new HTTPException(400, { message: "Invalid feed item" });
  }
  return row;
}
