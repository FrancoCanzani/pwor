import { createContext, useContext, type ReactNode } from "react";

type CommandPaletteController = {
  open: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteController | null>(
  null,
);

export function CommandPaletteProvider({
  value,
  children,
}: {
  value: CommandPaletteController;
  children: ReactNode;
}) {
  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteController {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within AppShell");
  }
  return ctx;
}
