import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { createDb } from "../../../db";
import { pack } from "../../../db/schema";
import type { AppEnv } from "../../../types";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2),
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type SearchKind = "pack";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string | null;
  workspaceId: string | null;
  updatedAt: number;
};

const app = new Hono<AppEnv>().get(
  "/",
  zValidator("query", searchQuerySchema),
  async (c) => {
    const user = c.get("user")!;
    const { q, workspaceId, limit } = c.req.valid("query");
    const db = createDb(c.env.DB);
    const pattern = `%${q}%`;

    const rows = await db
      .select({
        id: pack.id,
        title: pack.name,
        snippet: pack.description,
        workspaceId: pack.workspaceId,
        updatedAt: pack.updatedAt,
      })
      .from(pack)
      .where(
        and(
          eq(pack.userId, user.id),
          workspaceId ? eq(pack.workspaceId, workspaceId) : undefined,
          or(like(pack.name, pattern), like(pack.description, pattern)),
        ),
      )
      .orderBy(desc(pack.updatedAt))
      .limit(limit);

    const items: SearchHit[] = rows.map((row) => ({
      kind: "pack",
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      workspaceId: row.workspaceId,
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.getTime()
          : Number(row.updatedAt),
    }));

    return c.json({ items });
  },
);

export default app;
