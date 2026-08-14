import { Hono } from "hono";

import type { AppEnv } from "../../types";
import feedsRoutes from "./feeds";
import inboxRoutes from "./inbox";
import notesRoutes from "./notes";
import searchRoutes from "./search";
import itemRoutes from "./items";
import workspacesRoutes from "./workspaces";

const app = new Hono<AppEnv>()
  .get("/me", (c) => c.json(c.get("user")!))
  .route("/feeds", feedsRoutes)
  .route("/inbox", inboxRoutes)
  .route("/notes", notesRoutes)
  .route("/search", searchRoutes)
  .route("/items", itemRoutes)
  .route("/workspaces", workspacesRoutes);

export default app;
