import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { feed } from "../../db/schema";
import type { AppEnv } from "../../types";

export function registerDeleteFeed(app: Hono<AppEnv>) {
  return app.delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);
    const result = await db
      .delete(feed)
      .where(ownedBy(feed.id, id, feed.userId, user.id))
      .returning({ id: feed.id });
    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }
    return c.json({ ok: true });
  });
}
