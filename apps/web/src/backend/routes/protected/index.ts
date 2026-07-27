import { Hono } from "hono";

import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>().get("/me", (c) => c.json(c.get("user")!));

export default app;
