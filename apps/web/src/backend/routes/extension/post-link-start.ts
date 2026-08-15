import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { extensionPairing } from "../../db/schema";
import { randomToken, sha256Hex } from "../../lib/token";
import type { AppEnv } from "../../types";
import { PAIRING_TTL_MS, appOrigin, startSchema } from "./lib/pairing-util";

export function registerPostLinkStart(app: Hono<AppEnv>) {
  return app.post(
    "/link/start",
    zValidator("json", startSchema),
    async (c) => {
      const pairingId = crypto.randomUUID();
      const secret = randomToken(24);
      const secretHash = await sha256Hex(secret);
      const db = createDb(c.env.DB);

      await db.insert(extensionPairing).values({
        id: pairingId,
        secretHash,
        status: "pending",
        expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
      });

      return c.json({
        pairingId,
        secret,
        linkUrl: `${appOrigin(c.env)}/extension/link?pairing=${encodeURIComponent(pairingId)}`,
        expiresInMs: PAIRING_TTL_MS,
      });
    },
  );
}
