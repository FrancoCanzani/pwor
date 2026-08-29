import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";

import type { AppEnv } from "../../types";
import { deleteOwnedItems } from "./lib/mutate";
import { idsSchema } from "./schemas";

export function registerDeleteItems(app: Hono<AppEnv>) {
  return app.delete("/", zValidator("json", idsSchema), async (c) => {
    const user = c.get("user")!;
    const { ids } = c.req.valid("json");
    await deleteOwnedItems(c.env, c.executionCtx, user.id, ids);
    return c.json({ ids });
  });
}

export function registerDeleteItem(app: Hono<AppEnv>) {
  return app.delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    await deleteOwnedItems(c.env, c.executionCtx, user.id, [id]);
    return c.json({ id });
  });
}
