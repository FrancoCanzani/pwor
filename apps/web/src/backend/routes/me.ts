import type { Hono } from "hono";

import type { AppEnv } from "../types";

export function registerGetMe(app: Hono<AppEnv>) {
  return app.get("/me", (c) => c.json(c.get("user")!));
}
