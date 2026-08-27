import { HTTPException } from "hono/http-exception";

import type { Db } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { item } from "../../../db/schema";

export async function loadOwnedItem(db: Db, id: string, userId: string) {
  const [row] = await db
    .select()
    .from(item)
    .where(ownedBy(item.id, id, item.userId, userId))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Not found" });
  return row;
}
