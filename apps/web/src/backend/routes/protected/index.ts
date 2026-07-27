import { Hono } from "hono";

import type { AppEnv } from "../../types";
import vaultRoutes from "./vault";

const app = new Hono<AppEnv>()
  .get("/me", (c) => c.json(c.get("user")!))
  .route("/vault", vaultRoutes);

export default app;
