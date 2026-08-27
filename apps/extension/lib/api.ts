import {
  APP_URL,
  STORAGE_KEYS,
  type ExtensionUser,
  type Item,
  type LinkingState,
  type Space,
} from "./config";

async function getApiKey(): Promise<string | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.apiKey);
  return (stored[STORAGE_KEYS.apiKey] as string | undefined) ?? null;
}

export async function getStoredUser(): Promise<ExtensionUser | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.user);
  return (stored[STORAGE_KEYS.user] as ExtensionUser | undefined) ?? null;
}

export async function getStoredSpaceId(): Promise<string | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.spaceId);
  return (stored[STORAGE_KEYS.spaceId] as string | undefined) ?? null;
}

export async function setStoredSpaceId(id: string | null) {
  if (id) {
    await browser.storage.local.set({ [STORAGE_KEYS.spaceId]: id });
    return;
  }
  await browser.storage.local.remove(STORAGE_KEYS.spaceId);
}

export async function resolveStoredSpaceId(): Promise<string | null> {
  const id = await getStoredSpaceId();
  if (!id) return null;
  const spaces = await listSpaces().catch(() => null);
  if (!spaces) return id;
  if (spaces.some((space) => space.id === id)) return id;
  await setStoredSpaceId(null);
  return null;
}

export function spaceLabel(
  spaceId: string | null,
  spaces: Space[],
): string {
  if (!spaceId) return "Inbox";
  const name = spaces.find((space) => space.id === spaceId)?.name.trim();
  return name || "Untitled";
}

export async function setSession(apiKey: string, user: ExtensionUser) {
  await browser.storage.local.set({
    [STORAGE_KEYS.apiKey]: apiKey,
    [STORAGE_KEYS.user]: user,
  });
}

export async function clearSession() {
  await browser.storage.local.remove([
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.user,
    STORAGE_KEYS.linking,
  ]);
}

function isLinkingState(value: unknown): value is LinkingState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.pairingId === "string" &&
    typeof state.secret === "string" &&
    typeof state.linkUrl === "string" &&
    typeof state.startedAt === "number"
  );
}

export async function getLinkingState(): Promise<LinkingState | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.linking);
  const value = stored[STORAGE_KEYS.linking];
  return isLinkingState(value) ? value : null;
}

export async function setLinkingState(state: LinkingState) {
  await browser.storage.local.set({ [STORAGE_KEYS.linking]: state });
}

export async function clearLinkingState() {
  await browser.storage.local.remove(STORAGE_KEYS.linking);
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

export async function listSpaces(): Promise<Space[]> {
  const body = await api<{ items: Space[] }>("/api/spaces");
  return body.items;
}

export type CaptureInput = {
  input: string;
  spaceId?: string | null;
  autoSpace?: boolean;
  hint?: string | null;
  tags?: string[];
  preferredSpaceId?: string | null;
};

export async function capture(input: CaptureInput): Promise<Item> {
  const spaceId =
    input.spaceId !== undefined
      ? input.spaceId
      : await resolveStoredSpaceId();
  return api<Item>("/api/items", {
    method: "POST",
    body: JSON.stringify({ ...input, spaceId }),
  });
}

export async function updateItemSpace(
  id: string,
  spaceId: string | null,
): Promise<Item> {
  return api<Item>(`/api/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ spaceId }),
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
