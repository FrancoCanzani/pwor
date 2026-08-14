import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { note, item, workspace } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  shader: z.string().trim().min(1).optional(),
});

const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    shader: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.shader !== undefined,
    { message: "name, description, or shader is required" },
  );

const app = new Hono<AppEnv>()
  .get("/", async (c) => {
    const user = c.get("user")!;
    const db = createDb(c.env.DB);

    const items = await db
      .select()
      .from(workspace)
      .where(eq(workspace.userId, user.id))
      .orderBy(desc(workspace.updatedAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createWorkspaceSchema), async (c) => {
    const user = c.get("user")!;
    const { name, description, shader } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    const [created] = await db
      .insert(workspace)
      .values({
        id,
        userId: user.id,
        name,
        description: description ?? null,
        shader: shader ?? "nebula",
      })
      .returning();

    return c.json(created, 201);
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [space] = await db
      .select()
      .from(workspace)
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .limit(1);

    if (!space) throw new HTTPException(404, { message: "Not found" });

    const [notes, items] = await Promise.all([
      db
        .select({
          id: note.id,
          title: note.title,
          updatedAt: note.updatedAt,
          createdAt: note.createdAt,
        })
        .from(note)
        .where(and(eq(note.workspaceId, id), eq(note.userId, user.id)))
        .orderBy(desc(note.updatedAt)),
      db
        .select()
        .from(item)
        .where(and(eq(item.workspaceId, id), eq(item.userId, user.id)))
        .orderBy(desc(item.createdAt)),
    ]);

    return c.json({ ...space, notes, items });
  })

  .patch("/:id", zValidator("json", updateWorkspaceSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { name, description, shader } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [updated] = await db
      .update(workspace)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(shader !== undefined ? { shader } : {}),
      })
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });

    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const result = await db
      .delete(workspace)
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .returning({ id: workspace.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json({ ok: true });
  });

export default app;
