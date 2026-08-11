import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";

import { createAuth } from "./lib/auth";
import { authMiddleware, requireAuth } from "./middleware/auth";
import protectedRoutes from "./routes/protected";
import { cleanupOrphanNoteImages } from "./routes/protected/notes/cleanup";
import publicRoutes from "./routes/public";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", secureHeaders());

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.use("*", authMiddleware);

app.on(["GET", "POST"], "/api/auth/*", (c) =>
  createAuth(c.env).handler(c.req.raw),
);

app.route("/", publicRoutes);

app.use("/api/*", requireAuth);
app.route("/api", protectedRoutes);

export default {
  fetch: app.fetch,

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await cleanupOrphanNoteImages(env);
  },
};
