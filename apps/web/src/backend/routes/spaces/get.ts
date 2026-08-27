import type { Hono } from "hono";

import { createDb } from "../../db";
import type { AppEnv } from "../../types";
import { loadOwnedSpace } from "./lib/load";

export function registerGetSpace(app: Hono<AppEnv>) {
  return app.get("/:id", async (c) => {
    const user = c.get("user")!;
    const row = await loadOwnedSpace(createDb(c.env.DB), c.req.param("id"), user.id);
    return c.json(row);
  });
}
