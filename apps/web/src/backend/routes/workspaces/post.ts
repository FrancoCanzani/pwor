import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { workspace } from "../../db/schema";
import type { AppEnv } from "../../types";
import { createWorkspaceSchema } from "./schemas";

export function registerPostWorkspace(app: Hono<AppEnv>) {
  return app.post(
    "/",
    zValidator("json", createWorkspaceSchema),
    async (c) => {
      const user = c.get("user")!;
      const { name, description, shader } = c.req.valid("json");
      const db = createDb(c.env.DB);
      const id = crypto.randomUUID();

      const [created] = await db
        .insert(workspace)
        .values({
          id,
          userId: user.id,
          name,
          description: description ?? null,
          shader: shader ?? "nebula",
        })
        .returning();

      return c.json(created, 201);
    },
  );
}
