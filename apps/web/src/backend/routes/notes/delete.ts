import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";

import type { AppEnv } from "../../types";
import { deleteOwnedNotes } from "./lib/mutate";
import { idsSchema } from "./schemas";

export function registerDeleteNotes(app: Hono<AppEnv>) {
  return app.delete("/", zValidator("json", idsSchema), async (c) => {
    const user = c.get("user")!;
    const { ids } = c.req.valid("json");
    await deleteOwnedNotes(c.env, c.executionCtx, user.id, ids);
    return c.json({ ok: true });
  });
}

export function registerDeleteNote(app: Hono<AppEnv>) {
  return app.delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    await deleteOwnedNotes(c.env, c.executionCtx, user.id, [id]);
    return c.json({ ok: true });
  });
}
