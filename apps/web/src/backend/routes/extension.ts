import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { createDb } from "../db";
import { extensionDevice, extensionPairing, user } from "../db/schema";
import { randomToken, sha256Hex } from "../lib/extension-token";
import type { AppEnv } from "../types";

const PAIRING_TTL_MS = 10 * 60 * 1000;

const startSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

const pollSchema = z.object({
  pairingId: z.string().min(1),
  secret: z.string().min(1),
});

const approveSchema = z.object({
  pairingId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
});

function appOrigin(env: Env): string {
  return env.BETTER_AUTH_URL.replace(/\/$/, "");
}

const app = new Hono<AppEnv>()
  /** Extension starts a pairing session (unauthenticated). */
  .post("/link/start", zValidator("json", startSchema), async (c) => {
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

    const linkUrl = `${appOrigin(c.env)}/extension/link?pairing=${encodeURIComponent(pairingId)}`;

    return c.json({
      pairingId,
      secret,
      linkUrl,
      expiresInMs: PAIRING_TTL_MS,
    });
  })

  /** Extension polls until the user approves (unauthenticated, secret required). */
  .post("/link/poll", zValidator("json", pollSchema), async (c) => {
    const { pairingId, secret } = c.req.valid("json");
    const secretHash = await sha256Hex(secret);
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(extensionPairing)
      .where(eq(extensionPairing.id, pairingId))
      .limit(1);

    if (!row || row.secretHash !== secretHash) {
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

    if (row.status === "consumed" || !row.token || !row.userId) {
      return c.json({ status: "consumed" as const });
    }

    const [account] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, row.userId))
      .limit(1);

    await db
      .update(extensionPairing)
      .set({ status: "consumed", token: null })
      .where(eq(extensionPairing.id, pairingId));

    return c.json({
      status: "approved" as const,
      token: row.token,
      user: { id: row.userId, email: account?.email ?? "" },
    });
  })

  /** Signed-in user approves the pairing (cookie session). */
  .post("/link/approve", zValidator("json", approveSchema), async (c) => {
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

    const token = `pwor_ext_${randomToken(32)}`;
    const tokenHash = await sha256Hex(token);
    const deviceId = crypto.randomUUID();

    await db.insert(extensionDevice).values({
      id: deviceId,
      userId: sessionUser.id,
      tokenHash,
      name: name?.trim() || "Browser",
    });

    await db
      .update(extensionPairing)
      .set({
        status: "approved",
        userId: sessionUser.id,
        token,
      })
      .where(eq(extensionPairing.id, pairingId));

    return c.json({ ok: true as const });
  })

  .get("/devices", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    const db = createDb(c.env.DB);
    const items = await db
      .select({
        id: extensionDevice.id,
        name: extensionDevice.name,
        createdAt: extensionDevice.createdAt,
        lastUsedAt: extensionDevice.lastUsedAt,
      })
      .from(extensionDevice)
      .where(
        and(
          eq(extensionDevice.userId, sessionUser.id),
          isNull(extensionDevice.revokedAt),
        ),
      );

    return c.json({ items });
  })

  .delete("/devices/:id", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select({ id: extensionDevice.id })
      .from(extensionDevice)
      .where(
        and(
          eq(extensionDevice.id, id),
          eq(extensionDevice.userId, sessionUser.id),
          isNull(extensionDevice.revokedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new HTTPException(404, { message: "Device not found" });
    }

    await db
      .update(extensionDevice)
      .set({ revokedAt: new Date() })
      .where(eq(extensionDevice.id, id));

    return c.json({ ok: true as const });
  });

export default app;
