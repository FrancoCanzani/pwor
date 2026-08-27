import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";

import type { AppEnv } from "../../types";
import { createNote } from "./lib/create";
import { createNoteSchema } from "./schemas";

export function registerPostNote(app: Hono<AppEnv>) {
  return app.post("/", zValidator("json", createNoteSchema), async (c) => {
    const user = c.get("user")!;
    const created = await createNote(
      c.env,
      c.executionCtx,
      user.id,
      c.req.valid("json"),
    );
    return c.json(created, 201);
  });
}
