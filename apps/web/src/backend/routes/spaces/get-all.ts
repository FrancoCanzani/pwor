import type { Hono } from "hono";

import { createDb } from "../../db";
import type { AppEnv } from "../../types";
import { listOwnedSpaces } from "./lib/load";

export function registerGetAllSpaces(app: Hono<AppEnv>) {
  return app.get("/", async (c) => {
    const user = c.get("user")!;
    const items = await listOwnedSpaces(createDb(c.env.DB), user.id);
    return c.json({ items });
  });
}
