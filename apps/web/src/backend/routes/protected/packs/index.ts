import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { pack, workspace } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

const createPackSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
});

const updatePackSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    workspaceId: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.workspaceId !== undefined,
    { message: "name, description, or workspaceId is required" },
  );

async function assertWorkspaceOwned(
  db: ReturnType<typeof createDb>,
  workspaceId: string,
  userId: string,
) {
  const [row] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(ownedBy(workspace.id, workspaceId, workspace.userId, userId))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Workspace not found" });
}

const app = new Hono<AppEnv>()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const items = workspaceId
      ? await db
          .select()
          .from(pack)
          .where(
            and(eq(pack.userId, user.id), eq(pack.workspaceId, workspaceId)),
          )
          .orderBy(desc(pack.updatedAt))
      : await db
          .select()
          .from(pack)
          .where(eq(pack.userId, user.id))
          .orderBy(desc(pack.updatedAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createPackSchema), async (c) => {
    const user = c.get("user")!;
    const { name, description, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    if (workspaceId) {
      await assertWorkspaceOwned(db, workspaceId, user.id);
    }

    const id = crypto.randomUUID();
    const [created] = await db
      .insert(pack)
      .values({
        id,
        userId: user.id,
        name,
        description: description ?? null,
        workspaceId: workspaceId ?? null,
      })
      .returning();

    return c.json(created, 201);
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(pack)
      .where(ownedBy(pack.id, id, pack.userId, user.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    return c.json(item);
  })

  .patch("/:id", zValidator("json", updatePackSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { name, description, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    if (workspaceId) {
      await assertWorkspaceOwned(db, workspaceId, user.id);
    }

    const [updated] = await db
      .update(pack)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(workspaceId !== undefined ? { workspaceId } : {}),
      })
      .where(ownedBy(pack.id, id, pack.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });

    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const result = await db
      .delete(pack)
      .where(ownedBy(pack.id, id, pack.userId, user.id))
      .returning({ id: pack.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json({ ok: true });
  });

export default app;
