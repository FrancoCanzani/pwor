import { createAuth } from "./auth";

export type ListedApiKey = {
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

export type ApiKeyKind = "extension" | "mcp";

export function apiKeyKind(key: ListedApiKey): ApiKeyKind | undefined {
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
  if (kind === "extension" || kind === "mcp") return kind;
  return undefined;
}

export function isExtensionDeviceKey(key: ListedApiKey): boolean {
  if (key.enabled === false) return false;
  const kind = apiKeyKind(key);
  if (kind === "mcp") return false;
  return (
    kind === "extension" ||
    key.prefix === "pwor_" ||
    (key.start?.startsWith("pwor_") ?? false)
  );
}

export function isMcpApiKey(key: ListedApiKey): boolean {
  if (key.enabled === false) return false;
  return apiKeyKind(key) === "mcp";
}

export async function listUserApiKeys(
  env: Env,
  headers: Headers,
): Promise<ListedApiKey[]> {
  const listed = await createAuth(env).api.listApiKeys({ headers });
  if (Array.isArray(listed)) return listed as ListedApiKey[];
  if (listed && typeof listed === "object" && "apiKeys" in listed) {
    return ((listed as { apiKeys?: ListedApiKey[] }).apiKeys ??
      []) as ListedApiKey[];
  }
  return [];
}

export async function findUserApiKey(
  env: Env,
  headers: Headers,
  id: string,
): Promise<ListedApiKey | undefined> {
  const keys = await listUserApiKeys(env, headers);
  return keys.find((key) => key.id === id);
}
