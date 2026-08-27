import { HTTPException } from "hono/http-exception";

import type { Db } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { note } from "../../../db/schema";

export async function loadOwnedNote(db: Db, id: string, userId: string) {
  const [row] = await db
    .select()
    .from(note)
    .where(ownedBy(note.id, id, note.userId, userId))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Not found" });
  return row;
}
