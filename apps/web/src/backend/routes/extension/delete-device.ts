import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createAuth } from "../../lib/auth";
import type { AppEnv } from "../../types";

export function registerDeleteDevice(app: Hono<AppEnv>) {
  return app.delete("/devices/:id", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    try {
      await createAuth(c.env).api.deleteApiKey({
        body: { keyId: c.req.param("id") },
        headers: c.req.raw.headers,
      });
    } catch {
      throw new HTTPException(404, { message: "Device not found" });
    }

    return c.json({ ok: true as const });
  });
}
