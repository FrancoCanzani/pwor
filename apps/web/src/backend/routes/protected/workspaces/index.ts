import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import {
  note,
  task,
  vaultItem,
  workspace,
  workspaceInbox,
} from "../../../db/schema";
import type { AppEnv } from "../../../types";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
});

const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.description !== undefined,
    { message: "name or description is required" },
  );

const createInboxSchema = z.object({
  label: z.string().trim().nullable().optional(),
});

function generateInboxToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

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
    const { name, description } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    await db.insert(workspace).values({
      id,
      userId: user.id,
      name,
      description: description ?? null,
    });

    const [created] = await db
      .select()
      .from(workspace)
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(workspace)
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    const [tasks, notes, vaultItems, inboxes] = await Promise.all([
      db
        .select()
        .from(task)
        .where(and(eq(task.workspaceId, id), eq(task.userId, user.id)))
        .orderBy(desc(task.createdAt)),
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
        .from(vaultItem)
        .where(
          and(eq(vaultItem.workspaceId, id), eq(vaultItem.userId, user.id)),
        )
        .orderBy(desc(vaultItem.createdAt)),
      db
        .select()
        .from(workspaceInbox)
        .where(
          and(
            eq(workspaceInbox.workspaceId, id),
            eq(workspaceInbox.userId, user.id),
          ),
        )
        .orderBy(desc(workspaceInbox.createdAt)),
    ]);

    return c.json({ ...item, tasks, notes, vaultItems, inboxes });
  })

  .patch("/:id", zValidator("json", updateWorkspaceSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { name, description } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: workspace.id })
      .from(workspace)
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: "Not found" });

    await db
      .update(workspace)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      })
      .where(ownedBy(workspace.id, id, workspace.userId, user.id));

    const [updated] = await db
      .select()
      .from(workspace)
      .where(ownedBy(workspace.id, id, workspace.userId, user.id))
      .limit(1);

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
  })

  .post(
    "/:id/inboxes",
    zValidator("json", createInboxSchema),
    async (c) => {
      const user = c.get("user")!;
      const workspaceId = c.req.param("id");
      const { label } = c.req.valid("json");
      const db = createDb(c.env.DB);

      const [existing] = await db
        .select({ id: workspace.id })
        .from(workspace)
        .where(ownedBy(workspace.id, workspaceId, workspace.userId, user.id))
        .limit(1);

      if (!existing) throw new HTTPException(404, { message: "Not found" });

      const id = crypto.randomUUID();
      const token = generateInboxToken();

      await db.insert(workspaceInbox).values({
        id,
        workspaceId,
        userId: user.id,
        token,
        label: label ?? null,
      });

      const [created] = await db
        .select()
        .from(workspaceInbox)
        .where(ownedBy(workspaceInbox.id, id, workspaceInbox.userId, user.id))
        .limit(1);

      return c.json(created, 201);
    },
  )

  .delete("/:id/inboxes/:inboxId", async (c) => {
    const user = c.get("user")!;
    const inboxId = c.req.param("inboxId");
    const db = createDb(c.env.DB);

    const result = await db
      .delete(workspaceInbox)
      .where(
        ownedBy(workspaceInbox.id, inboxId, workspaceInbox.userId, user.id),
      )
      .returning({ id: workspaceInbox.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json({ ok: true });
  });

export default app;
