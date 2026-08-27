import type { Hono } from "hono";

import { createDb } from "../../db";
import type { AppEnv } from "../../types";
import { loadOwnedNote } from "./lib/load";
import { serializeNote } from "./lib/serialize";

export function registerGetNote(app: Hono<AppEnv>) {
  return app.get("/:id", async (c) => {
    const user = c.get("user")!;
    const row = await loadOwnedNote(createDb(c.env.DB), c.req.param("id"), user.id);
    return c.json(serializeNote(row));
  });
}
