import { createContext, useContext, type ReactNode } from "react";

type CreateDialogController = {
  open: () => void;
};

const CreateDialogContext = createContext<CreateDialogController | null>(null);

export function CreateDialogProvider({
  value,
  children,
}: {
  value: CreateDialogController;
  children: ReactNode;
}) {
  return (
    <CreateDialogContext.Provider value={value}>
      {children}
    </CreateDialogContext.Provider>
  );
}

export function useCreateDialog(): CreateDialogController {
  const ctx = useContext(CreateDialogContext);
  if (!ctx) {
    throw new Error("useCreateDialog must be used within AppShell");
  }
  return ctx;
}
