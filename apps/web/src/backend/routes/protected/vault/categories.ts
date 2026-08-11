import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { vaultCategory, vaultItem } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  workspaceId: z.string().nullable().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const categoriesQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

const app = new Hono<AppEnv>()
  .get("/", zValidator("query", categoriesQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultCategory.userId, user.id)];
    if (workspaceId) {
      conditions.push(eq(vaultCategory.workspaceId, workspaceId));
    }

    const items = await db
      .select()
      .from(vaultCategory)
      .where(and(...conditions))
      .orderBy(asc(vaultCategory.position), asc(vaultCategory.createdAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createCategorySchema), async (c) => {
    const user = c.get("user")!;
    const { name, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    const existing = await db
      .select({ position: vaultCategory.position })
      .from(vaultCategory)
      .where(
        and(
          eq(vaultCategory.userId, user.id),
          workspaceId
            ? eq(vaultCategory.workspaceId, workspaceId)
            : isNull(vaultCategory.workspaceId),
        ),
      )
      .orderBy(desc(vaultCategory.position))
      .limit(1);

    const position = (existing[0]?.position ?? -1) + 1;

    const [created] = await db
      .insert(vaultCategory)
      .values({
        id,
        userId: user.id,
        name,
        workspaceId: workspaceId ?? null,
        position,
      })
      .returning();

    return c.json(created, 201);
  })

  .patch("/:id", zValidator("json", updateCategorySchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { name } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [updated] = await db
      .update(vaultCategory)
      .set({ name })
      .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id))
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: vaultCategory.id })
      .from(vaultCategory)
      .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Not found" });
    }

    await db
      .update(vaultItem)
      .set({ categoryId: null })
      .where(
        and(eq(vaultItem.userId, user.id), eq(vaultItem.categoryId, id)),
      );

    await db
      .delete(vaultCategory)
      .where(ownedBy(vaultCategory.id, id, vaultCategory.userId, user.id));

    return c.json({ id });
  });

export default app;
