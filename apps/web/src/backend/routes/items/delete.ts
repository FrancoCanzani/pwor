import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { item } from "../../db/schema";
import { deleteEmbeddings, vectorId } from "../../lib/embed";
import type { AppEnv } from "../../types";
import { deleteNotesForItem } from "../notes/lib/cleanup";

export function registerDeleteItem(app: Hono<AppEnv>) {
  return app.delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Not found" });

    await deleteNotesForItem(db, c.env, id);
    await db.delete(item).where(eq(item.id, id));
    await deleteEmbeddings(c.env, [vectorId("item", id)]);
    if (row.r2Key) await c.env.ITEMS_BUCKET.delete(row.r2Key);
    if (row.previewR2Key) await c.env.ITEMS_BUCKET.delete(row.previewR2Key);

    return c.json({ id });
  });
}
