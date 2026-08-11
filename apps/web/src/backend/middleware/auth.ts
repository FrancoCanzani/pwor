import { and, eq, isNull } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { createDb } from "../db";
import { extensionDevice, user } from "../db/schema";
import { createAuth } from "../lib/auth";
import { sha256Hex } from "../lib/extension-token";
import type { AppEnv } from "../types";

async function userFromBearer(
  env: Env,
  authorization: string | undefined,
): Promise<{ id: string; email: string } | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token.startsWith("pwor_ext_")) return null;

  const tokenHash = await sha256Hex(token);
  const db = createDb(env.DB);
  const [device] = await db
    .select({
      id: extensionDevice.id,
      userId: extensionDevice.userId,
      email: user.email,
    })
    .from(extensionDevice)
    .innerJoin(user, eq(user.id, extensionDevice.userId))
    .where(
      and(
        eq(extensionDevice.tokenHash, tokenHash),
        isNull(extensionDevice.revokedAt),
      ),
    )
    .limit(1);

  if (!device) return null;

  await db
    .update(extensionDevice)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionDevice.id, device.id));

  return { id: device.userId, email: device.email };
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const bearerUser = await userFromBearer(
    c.env,
    c.req.header("Authorization"),
  );
  if (bearerUser) {
    c.set("user", bearerUser);
    await next();
    return;
  }

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
