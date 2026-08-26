import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { note } from "../../db/schema";
import type { AppEnv } from "../../types";
import { serializeNote } from "./lib/serialize";

export function registerGetNote(app: Hono<AppEnv>) {
  return app.get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(note)
      .where(ownedBy(note.id, id, note.userId, user.id))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Not found" });

    return c.json(serializeNote(row));
  });
}
