import { EXTENSION_API_KEY_PREFIX, createAuth } from "../lib/auth";
import type { AppUser } from "../types";

export function apiKeyFromRequest(request: Request): string | null {
  const header = request.headers.get("x-api-key")?.trim();
  if (header?.startsWith(EXTENSION_API_KEY_PREFIX)) return header;

  const authorization = request.headers.get("Authorization");
  if (!authorization) return null;
  const match = new RegExp(
    `^Bearer\\s+(${EXTENSION_API_KEY_PREFIX}\\S+)`,
    "i",
  ).exec(authorization.trim());
  return match?.[1] ?? null;
}

export async function authenticateMcp(
  env: Env,
  request: Request,
): Promise<AppUser | null> {
  const key = apiKeyFromRequest(request);
  if (!key) return null;

  const headers = new Headers();
  headers.set("x-api-key", key);
  const session = await createAuth(env).api.getSession({ headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}
