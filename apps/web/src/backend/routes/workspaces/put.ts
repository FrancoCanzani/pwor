import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { workspace } from "../../db/schema";
import type { AppEnv } from "../../types";
import { updateWorkspaceSchema } from "./schemas";

export function registerPutWorkspace(app: Hono<AppEnv>) {
  return app.patch(
    "/:id",
    zValidator("json", updateWorkspaceSchema),
    async (c) => {
      const user = c.get("user")!;
      const id = c.req.param("id");
      const { name, description, shader } = c.req.valid("json");
      const db = createDb(c.env.DB);

      const [updated] = await db
        .update(workspace)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(shader !== undefined ? { shader } : {}),
        })
        .where(ownedBy(workspace.id, id, workspace.userId, user.id))
        .returning();

      if (!updated) throw new HTTPException(404, { message: "Not found" });

      return c.json(updated);
    },
  );
}
