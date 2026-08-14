import {
  APP_URL,
  STORAGE_KEYS,
  type ExtensionUser,
  type Item,
  type Workspace,
} from "./config";

async function getApiKey(): Promise<string | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.apiKey);
  return (stored[STORAGE_KEYS.apiKey] as string | undefined) ?? null;
}

export async function getStoredUser(): Promise<ExtensionUser | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.user);
  return (stored[STORAGE_KEYS.user] as ExtensionUser | undefined) ?? null;
}

export async function getStoredWorkspaceId(): Promise<string | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.workspaceId);
  return (stored[STORAGE_KEYS.workspaceId] as string | undefined) ?? null;
}

export async function setStoredWorkspaceId(id: string) {
  await browser.storage.local.set({ [STORAGE_KEYS.workspaceId]: id });
}

export async function setSession(apiKey: string, user: ExtensionUser) {
  await browser.storage.local.set({
    [STORAGE_KEYS.apiKey]: apiKey,
    [STORAGE_KEYS.user]: user,
  });
}

export async function clearSession() {
  await browser.storage.local.remove([STORAGE_KEYS.apiKey, STORAGE_KEYS.user]);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("Not signed in");

  const headers = new Headers(init.headers);
  headers.set("x-api-key", apiKey);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    await clearSession();
    throw new Error("Session expired");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function fetchMe(): Promise<ExtensionUser> {
  return api<ExtensionUser>("/api/me");
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const body = await api<{ items: Workspace[] }>("/api/workspaces");
  return body.items;
}

export type CaptureInput = {
  input: string;
  workspaceId?: string | null;
  autoSpace?: boolean;
  hint?: string | null;
  tags?: string[];
  preferredWorkspaceId?: string | null;
};

export async function capture(input: CaptureInput): Promise<Item> {
  return api<Item>("/api/items/capture", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function startLink(): Promise<{
  pairingId: string;
  secret: string;
  linkUrl: string;
}> {
  const response = await fetch(`${APP_URL}/api/extension/link/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Browser" }),
  });
  if (!response.ok) {
    throw new Error("Could not start linking");
  }
  return (await response.json()) as {
    pairingId: string;
    secret: string;
    linkUrl: string;
  };
}

export async function pollLink(
  pairingId: string,
  secret: string,
): Promise<
  | { status: "pending" | "expired" | "consumed" }
  | { status: "approved"; apiKey: string; user: ExtensionUser }
> {
  const response = await fetch(`${APP_URL}/api/extension/link/poll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingId, secret }),
  });
  if (!response.ok) {
    throw new Error("Could not poll linking");
  }
  return (await response.json()) as
    | { status: "pending" | "expired" | "consumed" }
    | { status: "approved"; apiKey: string; user: ExtensionUser };
}
