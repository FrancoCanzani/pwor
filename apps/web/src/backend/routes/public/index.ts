import { Hono } from "hono";

import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>().get("/health", (c) => {
  return c.json({ ok: true as const });
});

export default app;
