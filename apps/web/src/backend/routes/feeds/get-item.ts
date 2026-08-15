import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { feed, feedItem } from "../../db/schema";
import type { AppEnv } from "../../types";
import { feedItemJoin, feedItemSelect } from "./lib/item-select";

export function registerGetFeedItem(app: Hono<AppEnv>) {
  return app.get("/items/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select(feedItemSelect)
      .from(feedItem)
      .innerJoin(feed, feedItemJoin)
      .where(ownedBy(feedItem.id, id, feedItem.userId, user.id))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Not found" });
    return c.json(row);
  });
}
