import { Hono } from "hono";

import type { AppEnv } from "../../types";
import packsRoutes from "./packs";
import searchRoutes from "./search";
import workspacesRoutes from "./workspaces";

const app = new Hono<AppEnv>()
  .get("/me", (c) => c.json(c.get("user")!))
  .route("/packs", packsRoutes)
  .route("/search", searchRoutes)
  .route("/workspaces", workspacesRoutes);

export default app;
