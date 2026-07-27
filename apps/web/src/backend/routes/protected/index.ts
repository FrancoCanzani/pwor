import { Hono } from "hono";

import vaultRoutes from "../../features/vault/routes";
import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>()
  .get("/me", (c) => c.json(c.get("user")!))
  .route("/vault", vaultRoutes);

export default app;
