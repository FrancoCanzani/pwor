import type { Hono } from "hono";

import type { AppEnv } from "../../types";
import { syncAllFeedsForUser } from "./lib/sync";

export function registerPostFeedsSync(app: Hono<AppEnv>) {
  return app.post("/sync", async (c) => {
    const user = c.get("user")!;
    const result = await syncAllFeedsForUser(c.env, user.id);
    return c.json(result);
  });
}
