import { HTTPException } from "hono/http-exception";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { vaultCategory } from "../../../db/schema";
import { normalizeVaultKind } from "../../../lib/vault-capture";

export function serializeVaultItem<T extends { kind: string }>(item: T) {
  return { ...item, kind: normalizeVaultKind(item.kind) };
}

export async function assertCategoryForWorkspace(
  db: ReturnType<typeof createDb>,
  categoryId: string,
  userId: string,
  workspaceId: string | null,
) {
  const [row] = await db
    .select({
      id: vaultCategory.id,
      workspaceId: vaultCategory.workspaceId,
    })
    .from(vaultCategory)
    .where(ownedBy(vaultCategory.id, categoryId, vaultCategory.userId, userId))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Category not found" });
  if ((row.workspaceId ?? null) !== (workspaceId ?? null)) {
    throw new HTTPException(400, { message: "Category workspace mismatch" });
  }
}
