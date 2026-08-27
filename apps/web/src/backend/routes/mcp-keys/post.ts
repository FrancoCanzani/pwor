import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { EXTENSION_API_KEY_TTL_SECONDS, createAuth } from "../../lib/auth";
import type { AppEnv } from "../../types";
import { createMcpKeySchema } from "./schemas";

export function registerPostMcpKey(app: Hono<AppEnv>) {
  return app.post("/keys", zValidator("json", createMcpKeySchema), async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { name } = c.req.valid("json");
    const created = await createAuth(c.env).api.createApiKey({
      body: {
        name: name || "Cursor",
        userId: sessionUser.id,
        expiresIn: EXTENSION_API_KEY_TTL_SECONDS,
        metadata: { kind: "mcp" },
      },
    });

    if (!created?.key) {
      throw new HTTPException(500, { message: "Could not create API key" });
    }

    return c.json(
      {
        id: created.id,
        name: created.name || "Cursor",
        key: created.key,
        start: created.start ?? null,
      },
      201,
    );
  });
}
