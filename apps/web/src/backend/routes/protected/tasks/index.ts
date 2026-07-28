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
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  dueAt: z.string().nullable().optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    dueAt: z.string().nullable().optional(),
    status: z.enum(["open", "done", "dismissed"]).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.dueAt !== undefined ||
      value.status !== undefined,
    { message: "title, dueAt, or status is required" },
  );

const app = new Hono<AppEnv>()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { status } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(task.userId, user.id)];
    if (status === "open") conditions.push(eq(task.status, "open"));

    const items = await db
      .select()
      .from(task)
      .where(and(...conditions))
      .orderBy(asc(task.dueAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createTaskSchema), async (c) => {
    const user = c.get("user")!;
    const { title, dueAt } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    await db.insert(task).values({
      id,
      userId: user.id,
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
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
    const { title, dueAt, status } = c.req.valid("json");
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
