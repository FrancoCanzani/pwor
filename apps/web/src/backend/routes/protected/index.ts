import { Hono } from "hono";

import type { AppEnv } from "../../types";
import inboxRoutes from "./inbox";
import notesRoutes from "./notes";
import searchRoutes from "./search";
import vaultRoutes from "./vault";
import workspacesRoutes from "./workspaces";

const app = new Hono<AppEnv>()
  .get("/me", (c) => c.json(c.get("user")!))
  .route("/inbox", inboxRoutes)
  .route("/notes", notesRoutes)
  .route("/search", searchRoutes)
  .route("/vault", vaultRoutes)
  .route("/workspaces", workspacesRoutes);

export default app;
