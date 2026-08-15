import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createAuth } from "../../lib/auth";
import type { AppEnv } from "../../types";

type ListedKey = {
  id: string;
  name: string | null;
  start?: string | null;
  prefix?: string | null;
  createdAt: Date | string;
  lastRequest?: Date | string | null;
  expiresAt?: Date | string | null;
  metadata?: unknown;
  enabled?: boolean | null;
};

function isExtensionKey(key: ListedKey): boolean {
  if (key.enabled === false) return false;
  let kind: string | undefined;
  if (typeof key.metadata === "string") {
    try {
      kind = (JSON.parse(key.metadata) as { kind?: string }).kind;
    } catch {
      kind = undefined;
    }
  } else if (key.metadata && typeof key.metadata === "object") {
    kind = (key.metadata as { kind?: string }).kind;
  }
  return (
    kind === "extension" ||
    key.prefix === "pwor_" ||
    (key.start?.startsWith("pwor_") ?? false)
  );
}

export function registerGetDevices(app: Hono<AppEnv>) {
  return app.get("/devices", async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const listed = await createAuth(c.env).api.listApiKeys({
      headers: c.req.raw.headers,
    });

    const keys: ListedKey[] = Array.isArray(listed)
      ? listed
      : listed && typeof listed === "object" && "apiKeys" in listed
        ? ((listed as { apiKeys?: ListedKey[] }).apiKeys ?? [])
        : [];

    return c.json({
      items: keys.filter(isExtensionKey).map((key) => ({
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
