import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy, assertOwnedSpace } from "../../db/helpers";
import { item } from "../../db/schema";
import { scheduleItemEmbed } from "../../lib/embed";
import type { AppEnv } from "../../types";
import { patchOwnedItems } from "./lib/mutate";
import { serializeItemDetail } from "./lib/serialize";
import { batchUpdateItemSchema, updateItemSchema } from "./schemas";

export function registerPatchItems(app: Hono<AppEnv>) {
  return app.patch("/", zValidator("json", batchUpdateItemSchema), async (c) => {
    const user = c.get("user")!;
    const { ids, spaceId, pinned } = c.req.valid("json");
    const items = await patchOwnedItems(c.env, user.id, ids, {
      spaceId,
      pinned,
    });
    return c.json({ items });
  });
}

export function registerPutItem(app: Hono<AppEnv>) {
  return app.patch("/:id", zValidator("json", updateItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { spaceId, title, pinned } = c.req.valid("json");
    const db = createDb(c.env.DB);

    if (spaceId !== undefined) {
      await assertOwnedSpace(db, spaceId, user.id);
    }

    const [updated] = await db
      .update(item)
      .set({
        ...(spaceId !== undefined ? { spaceId } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(pinned !== undefined
          ? { pinnedAt: pinned ? new Date() : null }
          : {}),
      })
      .where(ownedBy(item.id, id, item.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });
    if (title !== undefined) {
      scheduleItemEmbed(c.executionCtx, c.env, id);
    }
    return c.json(serializeItemDetail(updated));
  });
}
