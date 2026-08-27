const STORAGE_KEY = "pwor:current-space-id";

export function getStoredSpaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredSpaceId(id: string) {
  window.localStorage.setItem(STORAGE_KEY, id);
}
