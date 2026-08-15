import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy, assertOwnedWorkspace } from "../../db/helpers";
import { item } from "../../db/schema";
import type { AppEnv } from "../../types";
import { serializeItemDetail } from "./lib/serialize";
import { updateItemSchema } from "./schemas";

export function registerPutItem(app: Hono<AppEnv>) {
  return app.patch("/:id", zValidator("json", updateItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { workspaceId, title } = c.req.valid("json");
    const db = createDb(c.env.DB);

    if (workspaceId !== undefined) {
      await assertOwnedWorkspace(db, workspaceId, user.id);
    }

    const [updated] = await db
      .update(item)
      .set({
        ...(workspaceId !== undefined ? { workspaceId } : {}),
        ...(title !== undefined ? { title } : {}),
      })
      .where(ownedBy(item.id, id, item.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });
    return c.json(serializeItemDetail(updated));
  });
}
