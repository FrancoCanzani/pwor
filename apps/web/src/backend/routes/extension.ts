import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../db";
import { extensionPairing, user } from "../db/schema";
import {
  EXTENSION_API_KEY_TTL_SECONDS,
  createAuth,
} from "../lib/auth";
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

    return c.json({
      pairingId,
      secret,
      linkUrl: `${appOrigin(c.env)}/extension/link?pairing=${encodeURIComponent(pairingId)}`,
      expiresInMs: PAIRING_TTL_MS,
    });
  })

  /** Extension polls until approved; consumes the API key once. */
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
  })

  /** Signed-in user approves pairing and mints a Better Auth API key. */
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

    const auth = createAuth(c.env);
    const created = await auth.api.createApiKey({
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
  })

  .get("/devices", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const auth = createAuth(c.env);
    const listed = await auth.api.listApiKeys({
      headers: c.req.raw.headers,
    });

    const keys = (Array.isArray(listed)
      ? listed
      : ((listed as { apiKeys?: unknown[] } | null)?.apiKeys ??
        [])) as Array<{
      id: string;
      name: string | null;
      start?: string | null;
      prefix?: string | null;
      createdAt: Date | string;
      lastRequest?: Date | string | null;
      expiresAt?: Date | string | null;
      metadata?: unknown;
      enabled?: boolean | null;
    }>;

    const items = keys
      .filter((key) => {
        if (key.enabled === false) return false;
        let meta: { kind?: string } | null = null;
        if (typeof key.metadata === "string") {
          try {
            meta = JSON.parse(key.metadata) as { kind?: string };
          } catch {
            meta = null;
          }
        } else if (key.metadata && typeof key.metadata === "object") {
          meta = key.metadata as { kind?: string };
        }
        return (
          meta?.kind === "extension" ||
          key.prefix === "pwor_" ||
          (key.start?.startsWith("pwor_") ?? false)
        );
      })
      .map((key) => ({
        id: key.id,
        name: key.name || "Browser",
        start: key.start ?? null,
        createdAt: key.createdAt,
        lastUsedAt: key.lastRequest ?? null,
        expiresAt: key.expiresAt ?? null,
      }));

    return c.json({ items });
  })

  .delete("/devices/:id", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const id = c.req.param("id");
    const auth = createAuth(c.env);

    try {
      await auth.api.deleteApiKey({
        body: { keyId: id },
        headers: c.req.raw.headers,
      });
    } catch {
      throw new HTTPException(404, { message: "Device not found" });
    }

    return c.json({ ok: true as const });
  });

export default app;
