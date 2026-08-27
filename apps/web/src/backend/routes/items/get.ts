import type { Hono } from "hono";

import { createDb } from "../../db";
import type { AppEnv } from "../../types";
import { loadOwnedItem } from "./lib/load";
import { serializeItemDetail } from "./lib/serialize";

export function registerGetItem(app: Hono<AppEnv>) {
  return app.get("/:id", async (c) => {
    const user = c.get("user")!;
    const row = await loadOwnedItem(createDb(c.env.DB), c.req.param("id"), user.id);
    return c.json(serializeItemDetail(row));
  });
}
