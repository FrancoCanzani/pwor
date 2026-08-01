import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { inboxItem } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

const app = new Hono<AppEnv>()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(inboxItem.userId, user.id)];
    if (workspaceId) conditions.push(eq(inboxItem.workspaceId, workspaceId));

    const items = await db
      .select()
      .from(inboxItem)
      .where(and(...conditions))
      .orderBy(desc(inboxItem.createdAt));

    return c.json({ items });
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const result = await db
      .delete(inboxItem)
      .where(ownedBy(inboxItem.id, id, inboxItem.userId, user.id))
      .returning({ id: inboxItem.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json({ ok: true });
  });

export default app;
