import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { isMcpApiKey, listUserApiKeys } from "../../lib/api-keys";
import type { AppEnv } from "../../types";

export function registerGetMcpKeys(app: Hono<AppEnv>) {
  return app.get("/keys", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const keys = await listUserApiKeys(c.env, c.req.raw.headers);

    return c.json({
      items: keys.filter(isMcpApiKey).map((key) => ({
        id: key.id,
        name: key.name || "Cursor",
        start: key.start ?? null,
        createdAt: key.createdAt,
        lastUsedAt: key.lastRequest ?? null,
        expiresAt: key.expiresAt ?? null,
      })),
    });
  });
}
