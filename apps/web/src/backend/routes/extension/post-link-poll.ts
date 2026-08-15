import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { extensionPairing, user } from "../../db/schema";
import { sha256Hex } from "../../lib/token";
import type { AppEnv } from "../../types";
import { hashesEqual, pollSchema } from "./lib/pairing-util";

export function registerPostLinkPoll(app: Hono<AppEnv>) {
  return app.post("/link/poll", zValidator("json", pollSchema), async (c) => {
    const { pairingId, secret } = c.req.valid("json");
    const secretHash = await sha256Hex(secret);
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(extensionPairing)
      .where(eq(extensionPairing.id, pairingId))
      .limit(1);

    if (!row || !hashesEqual(row.secretHash, secretHash)) {
      throw new HTTPException(404, { message: "Pairing not found" });
    }

    if (row.expiresAt.getTime() < Date.now()) {
      await db
        .update(extensionPairing)
        .set({ status: "expired" })
        .where(eq(extensionPairing.id, pairingId));
      return c.json({ status: "expired" as const });
    }

    if (row.status === "pending") {
      return c.json({ status: "pending" as const });
    }

    if (row.status === "consumed" || !row.apiKey || !row.userId) {
      return c.json({ status: "consumed" as const });
    }

    const [account] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, row.userId))
      .limit(1);

    const apiKeyValue = row.apiKey;

    await db
      .update(extensionPairing)
      .set({ status: "consumed", apiKey: null })
      .where(eq(extensionPairing.id, pairingId));

    return c.json({
      status: "approved" as const,
      apiKey: apiKeyValue,
      user: { id: row.userId, email: account?.email ?? "" },
    });
  });
}
