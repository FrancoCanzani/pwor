import { Hono } from "hono";

import type { AppEnv } from "../../types";
import notesRoutes from "./notes";
import tasksRoutes from "./tasks";
import vaultRoutes from "./vault";

const app = new Hono<AppEnv>()
  .get("/me", (c) => c.json(c.get("user")!))
  .route("/notes", notesRoutes)
  .route("/tasks", tasksRoutes)
  .route("/vault", vaultRoutes);

export default app;
