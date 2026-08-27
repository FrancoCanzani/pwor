import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createAuth } from "../../lib/auth";
import { findUserApiKey, isMcpApiKey } from "../../lib/api-keys";
import type { AppEnv } from "../../types";

export function registerDeleteMcpKey(app: Hono<AppEnv>) {
  return app.delete("/keys/:id", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const key = await findUserApiKey(c.env, c.req.raw.headers, c.req.param("id"));
    if (!key || !isMcpApiKey(key)) {
      throw new HTTPException(404, { message: "Key not found" });
    }

    try {
      await createAuth(c.env).api.deleteApiKey({
        body: { keyId: key.id },
        headers: c.req.raw.headers,
      });
    } catch {
      throw new HTTPException(404, { message: "Key not found" });
    }

    return c.json({ ok: true as const });
  });
}
