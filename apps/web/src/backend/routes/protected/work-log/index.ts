import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { user, workLog } from "../../../db/schema";
import type { AppEnv } from "../../../types";
import {
  collectDaySources,
  draftWorkLogBody,
  isDayDate,
  utcToday,
} from "./draft";

const daySchema = z.string().refine(isDayDate, {
  message: "day must be YYYY-MM-DD",
});

const createSchema = z.object({
  body: z.string().optional().default(""),
  day: daySchema.optional(),
});

const draftSchema = z.object({
  day: daySchema.optional(),
});

const updateSchema = z.object({
  body: z.string(),
});

const authorSelect = {
  authorName: user.name,
  authorEmail: user.email,
  authorImage: user.image,
};

const entrySelect = {
  id: workLog.id,
  day: workLog.day,
  body: workLog.body,
  draftedAt: workLog.draftedAt,
  sourceTaskCount: workLog.sourceTaskCount,
  sourceNoteCount: workLog.sourceNoteCount,
  sources: workLog.sources,
  userId: workLog.userId,
  updatedAt: workLog.updatedAt,
  createdAt: workLog.createdAt,
  ...authorSelect,
};

function withAuthor<T extends {
  authorName: string;
  authorEmail: string;
  authorImage: string | null;
}>(row: T) {
  const { authorName, authorEmail, authorImage, ...rest } = row;
  return {
    ...rest,
    author: {
      name: authorName,
      email: authorEmail,
      image: authorImage,
    },
  };
}

const app = new Hono<AppEnv>()
  .get("/", async (c) => {
    const sessionUser = c.get("user")!;
    const db = createDb(c.env.DB);

    const rows = await db
      .select({
        id: workLog.id,
        day: workLog.day,
        body: workLog.body,
        draftedAt: workLog.draftedAt,
        sourceTaskCount: workLog.sourceTaskCount,
        sourceNoteCount: workLog.sourceNoteCount,
        updatedAt: workLog.updatedAt,
        createdAt: workLog.createdAt,
        ...authorSelect,
      })
      .from(workLog)
      .innerJoin(user, eq(workLog.userId, user.id))
      .where(eq(workLog.userId, sessionUser.id))
      .orderBy(desc(workLog.createdAt));

    return c.json({ items: rows.map(withAuthor) });
  })

  .post("/", zValidator("json", createSchema), async (c) => {
    const sessionUser = c.get("user")!;
    const { body, day: requested } = c.req.valid("json");
    const day = requested ?? utcToday();
    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    await db.insert(workLog).values({
      id,
      userId: sessionUser.id,
      day,
      body,
    });

    const [item] = await db
      .select(entrySelect)
      .from(workLog)
      .innerJoin(user, eq(workLog.userId, user.id))
      .where(ownedBy(workLog.id, id, workLog.userId, sessionUser.id))
      .limit(1);

    return c.json(withAuthor(item!), 201);
  })

  .post("/draft", zValidator("json", draftSchema), async (c) => {
    const sessionUser = c.get("user")!;
    const { day: requested } = c.req.valid("json");
    const day = requested ?? utcToday();
    const db = createDb(c.env.DB);

    const collected = await collectDaySources(db, sessionUser.id, day);
    const drafted = await draftWorkLogBody(c.env, collected.sources);
    const draftedAt = new Date();
    const id = crypto.randomUUID();

    await db.insert(workLog).values({
      id,
      userId: sessionUser.id,
      day,
      body: drafted.body,
      draftedAt,
      sourceTaskCount: collected.sourceTaskCount,
      sourceNoteCount: collected.sourceNoteCount,
      sources: drafted.sources,
    });

    const [item] = await db
      .select(entrySelect)
      .from(workLog)
      .innerJoin(user, eq(workLog.userId, user.id))
      .where(ownedBy(workLog.id, id, workLog.userId, sessionUser.id))
      .limit(1);

    return c.json(withAuthor(item!), 201);
  })

  .get("/:id", async (c) => {
    const sessionUser = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select(entrySelect)
      .from(workLog)
      .innerJoin(user, eq(workLog.userId, user.id))
      .where(ownedBy(workLog.id, id, workLog.userId, sessionUser.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    return c.json(withAuthor(item));
  })

  .patch("/:id", zValidator("json", updateSchema), async (c) => {
    const sessionUser = c.get("user")!;
    const id = c.req.param("id");
    const { body } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const touched = await db
      .update(workLog)
      .set({ body, updatedAt: new Date() })
      .where(ownedBy(workLog.id, id, workLog.userId, sessionUser.id))
      .returning({ id: workLog.id });

    if (touched.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const [updated] = await db
      .select(entrySelect)
      .from(workLog)
      .innerJoin(user, eq(workLog.userId, user.id))
      .where(ownedBy(workLog.id, id, workLog.userId, sessionUser.id))
      .limit(1);

    return c.json(withAuthor(updated!));
  })

  .delete("/:id", async (c) => {
    const sessionUser = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const result = await db
      .delete(workLog)
      .where(ownedBy(workLog.id, id, workLog.userId, sessionUser.id))
      .returning({ id: workLog.id });

    if (result.length === 0) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json({ ok: true });
  });

export default app;
