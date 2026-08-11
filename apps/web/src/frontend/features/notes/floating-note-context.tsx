import { createContext, useContext, type ReactNode } from "react";

type FloatingNoteController = {
  openNew: () => void;
  openNote: (noteId: string) => void;
};

const FloatingNoteContext = createContext<FloatingNoteController | null>(null);

export function FloatingNoteProvider({
  value,
  children,
}: {
  value: FloatingNoteController;
  children: ReactNode;
}) {
  return (
    <FloatingNoteContext.Provider value={value}>
      {children}
    </FloatingNoteContext.Provider>
  );
}

export function useFloatingNote(): FloatingNoteController {
  const ctx = useContext(FloatingNoteContext);
  if (!ctx) {
    throw new Error("useFloatingNote must be used within AppShell");
  }
  return ctx;
}
