import { HTTPException } from "hono/http-exception";

import type { Db } from "../db";
import { ownedBy } from "../db/helpers";
import { workspace } from "../db/schema";

/** 400s unless the workspace exists and belongs to the user. `null`/`undefined` (no space) passes. */
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
