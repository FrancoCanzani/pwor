import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { item, note, workspace } from "../../db/schema";
import type { AppEnv } from "../../types";
import { itemListColumns, serializeItem } from "../items/lib/serialize";

export function registerGetWorkspace(app: Hono<AppEnv>) {
  return app.get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [space] = await db
      .select()
      .from(workspace)
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .limit(1);

    if (!space) throw new HTTPException(404, { message: "Not found" });

    const [notes, items] = await Promise.all([
      db
        .select({
          id: note.id,
          title: note.title,
          updatedAt: note.updatedAt,
          createdAt: note.createdAt,
        })
        .from(note)
        .where(and(eq(note.workspaceId, id), eq(note.userId, user.id)))
        .orderBy(desc(note.updatedAt)),
      db
        .select(itemListColumns)
        .from(item)
        .where(and(eq(item.workspaceId, id), eq(item.userId, user.id)))
        .orderBy(desc(item.createdAt)),
    ]);

    return c.json({
      ...space,
      notes,
      items: items.map(serializeItem),
    });
  });
}
