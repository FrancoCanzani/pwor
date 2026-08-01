const STORAGE_KEY = "odiseum:current-workspace-id";

export function getStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredWorkspaceId(id: string) {
  window.localStorage.setItem(STORAGE_KEY, id);
}
