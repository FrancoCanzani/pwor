import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import type { Hono } from "hono";

import {
  noteBodyPreview,
  noteHasBody,
} from "@shared/note-frontmatter";
import { createDb } from "../../db";
import { note } from "../../db/schema";
import type { AppEnv } from "../../types";
import { listQuerySchema } from "./schemas";

export function registerGetAllNotes(app: Hono<AppEnv>) {
  return app.get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, itemId, feedItemId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(note.userId, user.id)];
    if (workspaceId) conditions.push(eq(note.workspaceId, workspaceId));
    if (itemId) conditions.push(eq(note.itemId, itemId));
    if (feedItemId) conditions.push(eq(note.feedItemId, feedItemId));

    const items = await db
      .select({
        id: note.id,
        title: note.title,
        workspaceId: note.workspaceId,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
        itemId: note.itemId,
        feedItemId: note.feedItemId,
        anchorFrom: note.anchorFrom,
        anchorTo: note.anchorTo,
        anchorQuote: note.anchorQuote,
        anchorPrefix: note.anchorPrefix,
        anchorSuffix: note.anchorSuffix,
        body: note.body,
      })
      .from(note)
      .where(and(...conditions))
      .orderBy(desc(note.updatedAt));

    return c.json({
      items: items.map(({ body, ...item }) => ({
        ...item,
        hasBody: noteHasBody(body),
        noted: noteHasBody(body),
        bodyPreview: noteBodyPreview(body),
      })),
    });
  });
}
