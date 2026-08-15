import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { createAuth } from "../lib/auth";
import type { AppEnv } from "../types";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });
  c.set(
    "user",
    session ? { id: session.user.id, email: session.user.email } : null,
  );
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  await next();
});

const PUBLIC_API_PATHS = new Set([
  "/api/extension/link/start",
  "/api/extension/link/poll",
]);

export const requireAuthUnlessPublic = createMiddleware<AppEnv>(
  async (c, next) => {
    if (PUBLIC_API_PATHS.has(c.req.path)) {
      await next();
      return;
    }
    return requireAuth(c, next);
  },
);
