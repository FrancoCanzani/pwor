import { useState } from "react";

export type LibraryViewMode = "list" | "grid" | "masonry";

export const LIBRARY_VIEW_ORDER: LibraryViewMode[] = [
  "list",
  "grid",
  "masonry",
];

export const LIBRARY_VIEW_LABEL: Record<LibraryViewMode, string> = {
  list: "List",
  grid: "Grid",
  masonry: "Masonry",
};

const STORAGE_KEY = "pwor:library-view";

export function isLibraryViewMode(value: unknown): value is LibraryViewMode {
  return value === "list" || value === "grid" || value === "masonry";
}

function readStoredView(key: string): LibraryViewMode {
  if (typeof window === "undefined") return "list";
  const stored = window.localStorage.getItem(key);
  return isLibraryViewMode(stored) ? stored : "list";
}

export function useLibraryView(options?: {
  storageKey?: string;
  modes?: readonly LibraryViewMode[];
}) {
  const storageKey = options?.storageKey ?? STORAGE_KEY;
  const modes = options?.modes ?? LIBRARY_VIEW_ORDER;
  const [view, setView] = useState<LibraryViewMode>(() =>
    readStoredView(storageKey),
  );

  const resolved = modes.includes(view)
    ? view
    : modes.includes("grid")
      ? "grid"
      : (modes[0] ?? "list");

  function change(next: LibraryViewMode) {
    if (!modes.includes(next)) return;
    setView(next);
    window.localStorage.setItem(storageKey, next);
  }

  return [resolved, change] as const;
}
