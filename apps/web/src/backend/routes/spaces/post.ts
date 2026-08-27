import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { space } from "../../db/schema";
import type { AppEnv } from "../../types";
import { createSpaceSchema } from "./schemas";

export function registerPostSpace(app: Hono<AppEnv>) {
  return app.post("/", zValidator("json", createSpaceSchema), async (c) => {
    const user = c.get("user")!;
    const { name, description } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    const [created] = await db
      .insert(space)
      .values({
        id,
        userId: user.id,
        name,
        description: description ?? null,
      })
      .returning();

    return c.json(created, 201);
  });
}
