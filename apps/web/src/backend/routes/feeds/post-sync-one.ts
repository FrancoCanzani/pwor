import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import type { AppEnv } from "../../types";
import { syncFeed } from "./lib/sync";

export function registerPostFeedSync(app: Hono<AppEnv>) {
  return app.post("/:id/sync", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    try {
      const result = await syncFeed(c.env, id, user.id);
      return c.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Feed not found") {
        throw new HTTPException(404, { message: "Not found" });
      }
      throw new HTTPException(502, {
        message: error instanceof Error ? error.message : "Sync failed",
      });
    }
  });
}
