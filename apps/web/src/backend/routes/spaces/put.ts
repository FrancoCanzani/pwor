import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { space } from "../../db/schema";
import type { AppEnv } from "../../types";
import { updateSpaceSchema } from "./schemas";

export function registerPutSpace(app: Hono<AppEnv>) {
  return app.patch("/:id", zValidator("json", updateSpaceSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { name, description } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [updated] = await db
      .update(space)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      })
      .where(ownedBy(space.id, id, space.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });

    return c.json(updated);
  });
}
