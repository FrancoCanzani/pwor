import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { note } from "../../db/schema";
import type { AppEnv } from "../../types";
import { serializeNoteListItem } from "./lib/serialize";
import { listQuerySchema } from "./schemas";

export function registerGetAllNotes(app: Hono<AppEnv>) {
  return app.get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { spaceId, itemId, standalone } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(note.userId, user.id)];
    if (spaceId) conditions.push(eq(note.spaceId, spaceId));
    if (itemId) conditions.push(eq(note.itemId, itemId));
    if (standalone) conditions.push(isNull(note.itemId));

    const items = await db
      .select({
        id: note.id,
        title: note.title,
        spaceId: note.spaceId,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
        itemId: note.itemId,
        anchorFrom: note.anchorFrom,
        anchorTo: note.anchorTo,
        anchorQuote: note.anchorQuote,
        anchorPrefix: note.anchorPrefix,
        anchorSuffix: note.anchorSuffix,
        pinnedAt: note.pinnedAt,
        body: note.body,
      })
      .from(note)
      .where(and(...conditions))
      .orderBy(desc(note.updatedAt));

    return c.json({
      items: items.map(serializeNoteListItem),
    });
  });
}
