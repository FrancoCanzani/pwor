import { desc, eq } from "drizzle-orm";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { workspace } from "../../db/schema";
import type { AppEnv } from "../../types";

export function registerGetAllWorkspaces(app: Hono<AppEnv>) {
  return app.get("/", async (c) => {
    const user = c.get("user")!;
    const db = createDb(c.env.DB);

    const items = await db
      .select()
      .from(workspace)
      .where(eq(workspace.userId, user.id))
      .orderBy(desc(workspace.updatedAt));

    return c.json({ items });
  });
}
