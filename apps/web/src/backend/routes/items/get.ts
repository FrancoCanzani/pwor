import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { item } from "../../db/schema";
import type { AppEnv } from "../../types";
import { serializeItemDetail } from "./lib/serialize";

export function registerGetItem(app: Hono<AppEnv>) {
  return app.get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json(serializeItemDetail(row));
  });
}
