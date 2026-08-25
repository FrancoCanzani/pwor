import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, isNull, lt, or } from "drizzle-orm";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { item } from "../../db/schema";
import type { AppEnv } from "../../types";
import { scheduleMissingScreenshots } from "./lib/enrichment";
import { itemListColumns, serializeItem } from "./lib/serialize";
import { listQuerySchema } from "./schemas";

function parseListCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const sep = cursor.indexOf("_");
  if (sep < 1) return null;
  const ms = Number(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (!Number.isFinite(ms) || !id) return null;
  return { createdAt: new Date(ms), id };
}

export function registerGetAllItems(app: Hono<AppEnv>) {
  return app.get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId, inbox, cursor, limit } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const baseConditions = [eq(item.userId, user.id)];
    if (inbox) {
      baseConditions.push(isNull(item.workspaceId));
    } else if (workspaceId) {
      baseConditions.push(eq(item.workspaceId, workspaceId));
    }

    const conditions = [...baseConditions];
    const parsedCursor = parseListCursor(cursor);
    if (parsedCursor) {
      const cursorWhere = or(
        lt(item.createdAt, parsedCursor.createdAt),
        and(
          eq(item.createdAt, parsedCursor.createdAt),
          lt(item.id, parsedCursor.id),
        ),
      );
      if (cursorWhere) conditions.push(cursorWhere);
    }

    const [rows, [totals]] = await Promise.all([
      db
        .select(itemListColumns)
        .from(item)
        .where(and(...conditions))
        .orderBy(desc(item.createdAt), desc(item.id))
        .limit(limit + 1),
      db
        .select({ total: count() })
        .from(item)
        .where(and(...baseConditions)),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    scheduleMissingScreenshots(c.executionCtx, c.env, page);

    return c.json({
      items: page.map(serializeItem),
      total: totals?.total ?? page.length,
      nextCursor:
        hasMore && last ? `${last.createdAt.getTime()}_${last.id}` : null,
    });
  });
}
