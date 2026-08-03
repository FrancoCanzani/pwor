import { Hono } from "hono";

import type { AppEnv } from "../../types";
import eventsRoutes from "./events";
import inboxRoutes from "./inbox";
import notesRoutes from "./notes";
import tasksRoutes from "./tasks";
import vaultRoutes from "./vault";
import workLogRoutes from "./work-log";
import workspacesRoutes from "./workspaces";

const app = new Hono<AppEnv>()
  .get("/me", (c) => c.json(c.get("user")!))
  .route("/events", eventsRoutes)
  .route("/inbox", inboxRoutes)
  .route("/notes", notesRoutes)
  .route("/tasks", tasksRoutes)
  .route("/vault", vaultRoutes)
  .route("/work-log", workLogRoutes)
  .route("/workspaces", workspacesRoutes);

export default app;
