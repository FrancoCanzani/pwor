import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { event } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

function assertEndNotBeforeStart(startAt: Date, endAt: Date | null) {
  if (endAt != null && endAt.getTime() < startAt.getTime()) {
    throw new HTTPException(400, {
      message: "endAt must be on or after startAt",
    });
  }
}

const createEventSchema = z.object({
  title: z.string().min(1),
  startAt: z.string(),
  endAt: z.string().nullable().optional(),
  allDay: z.boolean().optional(),
  workspaceId: z.string().nullable().optional(),
});

const updateEventSchema = z
  .object({
    title: z.string().min(1).optional(),
    startAt: z.string().optional(),
    endAt: z.string().nullable().optional(),
    allDay: z.boolean().optional(),
    workspaceId: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.startAt !== undefined ||
      value.endAt !== undefined ||
      value.allDay !== undefined ||
      value.workspaceId !== undefined,
    { message: "title, startAt, endAt, allDay, or workspaceId is required" },
  );

const app = new Hono<AppEnv>()
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(event.userId, user.id)];
    if (workspaceId) conditions.push(eq(event.workspaceId, workspaceId));

    const items = await db
      .select()
      .from(event)
      .where(and(...conditions))
      .orderBy(asc(event.startAt));

    return c.json({ items });
  })

  .post("/", zValidator("json", createEventSchema), async (c) => {
    const user = c.get("user")!;
    const { title, startAt, endAt, allDay, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : null;
    assertEndNotBeforeStart(start, end);

    const [created] = await db
      .insert(event)
      .values({
        id,
        userId: user.id,
        title,
        startAt: start,
        endAt: end,
        allDay: allDay ?? true,
        workspaceId: workspaceId ?? null,
      })
      .returning();

    return c.json(created, 201);
  })

  .patch("/:id", zValidator("json", updateEventSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { title, startAt, endAt, allDay, workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select()
      .from(event)
      .where(ownedBy(event.id, id, event.userId, user.id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    const nextStart =
      startAt !== undefined ? new Date(startAt) : existing.startAt;
    const nextEnd =
      endAt !== undefined
        ? endAt
          ? new Date(endAt)
          : null
        : existing.endAt;
    assertEndNotBeforeStart(nextStart, nextEnd);

    const [updated] = await db
      .update(event)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(startAt !== undefined ? { startAt: nextStart } : {}),
        ...(endAt !== undefined ? { endAt: nextEnd } : {}),
        ...(allDay !== undefined ? { allDay } : {}),
        ...(workspaceId !== undefined ? { workspaceId } : {}),
      })
      .where(ownedBy(event.id, id, event.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });

    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const result = await db
      .delete(event)
      .where(ownedBy(event.id, id, event.userId, user.id))
      .returning({ id: event.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json({ ok: true });
  });

export default app;
