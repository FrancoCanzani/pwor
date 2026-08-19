import { createContext, useContext, type ReactNode } from "react";

export type CaptureDraft = {
  input?: string;
  files?: File[];
};

type CaptureComposerController = {
  open: (draft?: CaptureDraft) => void;
  isOpen: boolean;
};

const CaptureComposerContext = createContext<CaptureComposerController | null>(
  null,
);

export function CaptureComposerProvider({
  value,
  children,
}: {
  value: CaptureComposerController;
  children: ReactNode;
}) {
  return (
    <CaptureComposerContext.Provider value={value}>
      {children}
    </CaptureComposerContext.Provider>
  );
}

export function useCaptureComposer(): CaptureComposerController {
  const ctx = useContext(CaptureComposerContext);
  if (!ctx) {
    throw new Error("useCaptureComposer must be used within AppShell");
  }
  return ctx;
}
