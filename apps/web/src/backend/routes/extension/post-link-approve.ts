import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { extensionPairing } from "../../db/schema";
import { EXTENSION_API_KEY_TTL_SECONDS, createAuth } from "../../lib/auth";
import type { AppEnv } from "../../types";
import { approveSchema } from "./lib/pairing-util";

export function registerPostLinkApprove(app: Hono<AppEnv>) {
  return app.post(
    "/link/approve",
    zValidator("json", approveSchema),
    async (c) => {
      const sessionUser = c.get("user");
      if (!sessionUser) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }

      const { pairingId, name } = c.req.valid("json");
      const db = createDb(c.env.DB);

      const [row] = await db
        .select()
        .from(extensionPairing)
        .where(eq(extensionPairing.id, pairingId))
        .limit(1);

      if (!row) {
        throw new HTTPException(404, { message: "Pairing not found" });
      }
      if (row.expiresAt.getTime() < Date.now()) {
        await db
          .update(extensionPairing)
          .set({ status: "expired" })
          .where(eq(extensionPairing.id, pairingId));
        throw new HTTPException(410, { message: "Pairing expired" });
      }
      if (row.status !== "pending") {
        throw new HTTPException(409, { message: "Pairing already used" });
      }

      const created = await createAuth(c.env).api.createApiKey({
        body: {
          name: name?.trim() || "Browser",
          userId: sessionUser.id,
          expiresIn: EXTENSION_API_KEY_TTL_SECONDS,
          metadata: { kind: "extension" },
        },
      });

      if (!created?.key) {
        throw new HTTPException(500, { message: "Could not create API key" });
      }

      await db
        .update(extensionPairing)
        .set({
          status: "approved",
          userId: sessionUser.id,
          apiKey: created.key,
        })
        .where(eq(extensionPairing.id, pairingId));

      return c.json({ ok: true as const });
    },
  );
}
