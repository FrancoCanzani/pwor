import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { inboxItem, task, workspaceInbox } from "../../../db/schema";
import type { AppEnv } from "../../../types";
import { extractTaskFromEmail } from "../../../lib/task-extraction";
import { handleInboundEmail } from "../../../email";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

const simulateSchema = z.object({
  workspaceId: z.string(),
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
  })

  .post("/simulate", zValidator("json", simulateSchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existingInbox] = await db
      .select({ token: workspaceInbox.token })
      .from(workspaceInbox)
      .where(
        and(
          eq(workspaceInbox.workspaceId, workspaceId),
          eq(workspaceInbox.userId, user.id),
        ),
      )
      .limit(1);

    let token = existingInbox?.token;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      await db.insert(workspaceInbox).values({
        id: crypto.randomUUID(),
        workspaceId,
        userId: user.id,
        token,
      });
    }

    const raw = `From: Alex <alex@example.com>
To: ${token}@inbound.pwor.app
Subject: Contract renewal needed by Friday
Content-Type: multipart/mixed; boundary="sim"
MIME-Version: 1.0

--sim
Content-Type: text/plain; charset="utf-8"

Hi,

Can you send the renewed contract paperwork over by this Friday? We need it signed before month end.

Thanks,
Alex
--sim
Content-Type: text/plain; name="notes.txt"
Content-Disposition: attachment; filename="notes.txt"

Renewal terms attached.
--sim--
`;

    const message = {
      to: `${token}@inbound.pwor.app`,
      from: "alex@example.com",
      raw: new Blob([raw]).stream(),
      setReject: () => {},
    } as unknown as ForwardableEmailMessage;

    await handleInboundEmail(message, c.env, c.executionCtx);

    return c.json({ ok: true });
  })

  .post("/:id/generate-task", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(inboxItem)
      .where(ownedBy(inboxItem.id, id, inboxItem.userId, user.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    let extracted: Awaited<ReturnType<typeof extractTaskFromEmail>>;
    try {
      extracted = await extractTaskFromEmail(c.env, item);
    } catch {
      throw new HTTPException(502, {
        message: "Could not generate a task from this email",
      });
    }

    const taskId = crypto.randomUUID();
    await db.insert(task).values({
      id: taskId,
      userId: user.id,
      workspaceId: item.workspaceId,
      title: extracted.title,
      dueAt: extracted.dueAt ? new Date(extracted.dueAt) : null,
      sourceType: "inbox_item",
      sourceId: item.id,
    });

    const [created] = await db
      .select()
      .from(task)
      .where(ownedBy(task.id, taskId, task.userId, user.id))
      .limit(1);

    return c.json(created, 201);
  });

export default app;
