import type { Hono } from "hono";

import type { AppEnv } from "../types";

export function registerGetHealth(app: Hono<AppEnv>) {
  return app.get("/health", (c) => c.json({ ok: true as const }));
}
