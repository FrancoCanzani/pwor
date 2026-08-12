import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";

import { handleInboundEmail } from "./email";
import { createAuth } from "./lib/auth";
import {
  authMiddleware,
  requireAuthUnlessPublic,
} from "./middleware/auth";
import extensionRoutes from "./routes/extension";
import protectedRoutes from "./routes/protected";
import { cleanupOrphanNoteImages } from "./routes/protected/notes/cleanup";
import publicRoutes from "./routes/public";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", secureHeaders());

app.use("/api/*", async (c, next) => {
  const corsMiddleware = cors({
    origin: (value) => {
      if (!value) return undefined;
      if (value.startsWith("chrome-extension://")) return value;
      if (value.startsWith("moz-extension://")) return value;
      const appUrl = c.env.BETTER_AUTH_URL.replace(/\/$/, "");
      if (value === appUrl) return value;
      if (value === "http://localhost:5173") return value;
      if (value === "http://127.0.0.1:5173") return value;
      return undefined;
    },
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

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

app.use("/api/*", requireAuthUnlessPublic);
app.route("/api/extension", extensionRoutes);
app.route("/api", protectedRoutes);

export default {
  fetch: app.fetch,

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await cleanupOrphanNoteImages(env);
  },

  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    await handleInboundEmail(message, env, ctx);
  },
};
