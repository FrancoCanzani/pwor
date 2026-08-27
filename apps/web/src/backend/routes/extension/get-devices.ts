import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { isExtensionDeviceKey, listUserApiKeys } from "../../lib/api-keys";
import type { AppEnv } from "../../types";

export function registerGetDevices(app: Hono<AppEnv>) {
  return app.get("/devices", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const keys = await listUserApiKeys(c.env, c.req.raw.headers);

    return c.json({
      items: keys.filter(isExtensionDeviceKey).map((key) => ({
        id: key.id,
        name: key.name || "Browser",
        start: key.start ?? null,
        createdAt: key.createdAt,
        lastUsedAt: key.lastRequest ?? null,
        expiresAt: key.expiresAt ?? null,
      })),
    });
  });
}
