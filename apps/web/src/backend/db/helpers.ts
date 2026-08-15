import { and, eq, type AnyColumn } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { Db } from "./index";
import { feedItem, item, workspace } from "./schema";

// Owner-scoped lookup: ownedBy(table.id, id, table.userId, userId)
export function ownedBy(
  idColumn: AnyColumn,
  id: string,
  userIdColumn: AnyColumn,
  userId: string,
) {
  return and(eq(idColumn, id), eq(userIdColumn, userId));
}

export async function assertOwnedWorkspace(
  db: Db,
  workspaceId: string | null | undefined,
  userId: string,
): Promise<void> {
  if (workspaceId == null) return;
  const [row] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(ownedBy(workspace.id, workspaceId, workspace.userId, userId))
    .limit(1);
  if (!row) {
    throw new HTTPException(400, { message: "Invalid workspace" });
  }
}

export async function assertOwnedItem(
  db: Db,
  itemId: string | null | undefined,
  userId: string,
): Promise<{ id: string; workspaceId: string | null } | null> {
  if (itemId == null) return null;
  const [row] = await db
    .select({ id: item.id, workspaceId: item.workspaceId })
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
