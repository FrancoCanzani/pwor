import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { task } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const listQuerySchema = z.object({
  status: z.enum(["open", "all"]).optional().default("open"),
  workspaceId: z.string().optional(),
  sourceType: z.enum(["vault_item", "note", "inbox_item"]).optional(),
  sourceId: z.string().optional(),
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  dueAt: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    dueAt: z.string().nullable().optional(),
    status: z.enum(["open", "done", "dismissed"]).optional(),
    workspaceId: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.dueAt !== undefined ||
      value.status !== undefined ||
      value.workspaceId !== undefined,
    { message: "title, dueAt, status, or workspaceId is required" },
  );

const app = new Hono<AppEnv>()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { status, workspaceId, sourceType, sourceId } =
      c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(task.userId, user.id)];
    if (status === "open") conditions.push(eq(task.status, "open"));
    if (workspaceId) conditions.push(eq(task.workspaceId, workspaceId));
    if (sourceType) conditions.push(eq(task.sourceType, sourceType));
    if (sourceId) conditions.push(eq(task.sourceId, sourceId));

    const items = await db
      .select()
      .from(task)
      .where(and(...conditions))
      .orderBy(asc(task.createdAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createTaskSchema), async (c) => {
    const user = c.get("user")!;
    const { title, dueAt, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    await db.insert(task).values({
      id,
      userId: user.id,
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
      workspaceId: workspaceId ?? null,
    });

    const [created] = await db
      .select()
      .from(task)
      .where(ownedBy(task.id, id, task.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  })

  .patch("/:id", zValidator("json", updateTaskSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { title, dueAt, status, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: task.id })
      .from(task)
      .where(ownedBy(task.id, id, task.userId, user.id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    await db
      .update(task)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(dueAt !== undefined
          ? { dueAt: dueAt ? new Date(dueAt) : null }
          : {}),
        ...(status !== undefined ? { status } : {}),
        ...(workspaceId !== undefined ? { workspaceId } : {}),
      })
      .where(ownedBy(task.id, id, task.userId, user.id));

    const [updated] = await db
      .select()
      .from(task)
      .where(ownedBy(task.id, id, task.userId, user.id))
      .limit(1);

    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const result = await db
      .delete(task)
      .where(ownedBy(task.id, id, task.userId, user.id))
      .returning({ id: task.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json({ ok: true });
  });

export default app;
