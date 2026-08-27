import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { Db } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { space } from "../../../db/schema";

export async function loadOwnedSpace(db: Db, id: string, userId: string) {
  const [row] = await db
    .select()
    .from(space)
    .where(ownedBy(space.id, id, space.userId, userId))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Not found" });
  return row;
}

export function listOwnedSpaces(db: Db, userId: string) {
  return db
    .select()
    .from(space)
    .where(eq(space.userId, userId))
    .orderBy(desc(space.updatedAt));
}
