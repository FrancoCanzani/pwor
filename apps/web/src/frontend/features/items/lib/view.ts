import { useState } from "react";

const STORAGE_KEY = "pwor:library-view";

export type LibraryView = "list" | "cards";

function readStoredView(): LibraryView {
  if (typeof window === "undefined") return "cards";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "list" || stored === "cards" ? stored : "cards";
}

export function useLibraryView(): [LibraryView, (view: LibraryView) => void] {
  const [view, setView] = useState<LibraryView>(readStoredView);

  function change(next: LibraryView) {
    setView(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return [view, change];
}
