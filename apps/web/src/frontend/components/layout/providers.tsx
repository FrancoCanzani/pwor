import { useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@features/command/components/command-palette";
import { CreateDialog } from "@features/command/components/create-dialog";
import { CreateDialogProvider } from "@features/command/create-dialog-context";
import { PasteCapture } from "@features/inbox/components/paste-capture";
import { noteQueryOptions } from "@features/notes/api";
import { FloatingNoteHost } from "@features/notes/components/floating-note-window";
import { FloatingNoteProvider } from "@features/notes/floating-note-context";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

export function Providers({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isFlush = pathname.split("/").filter(Boolean)[0] !== "settings";
  const { id: workspaceId } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [floatingNoteId, setFloatingNoteId] = useState<string | null>(null);

  function openNewNote() {
    if (!workspaceId) return;
    setFloatingNoteId(null);
    setFloatingOpen(true);
  }

  function openNote(noteId: string) {
    if (!workspaceId) return;
    void queryClient.prefetchQuery(noteQueryOptions(noteId));
    setFloatingNoteId(noteId);
    setFloatingOpen(true);
  }

  useHotkey("Mod+N", () => openNewNote(), { enabled: Boolean(workspaceId) });
  useHotkey("Mod+U", () => setCreateOpen(true));

  return (
    <TooltipProvider>
      <CreateDialogProvider value={{ open: () => setCreateOpen(true) }}>
        <FloatingNoteProvider
          value={{
            openNew: openNewNote,
            openNote,
            activeNoteId: floatingOpen ? floatingNoteId : null,
          }}
        >
          <SidebarProvider
            className={cn(isFlush && "h-svh min-h-0 overflow-hidden")}
          >
            <CommandPalette />
            <PasteCapture />
            <CreateDialog open={createOpen} onOpenChange={setCreateOpen} />
            {floatingOpen ? (
              <FloatingNoteHost
                noteId={floatingNoteId}
                onOpened={setFloatingNoteId}
                onClose={() => {
                  setFloatingOpen(false);
                  setFloatingNoteId(null);
                }}
              />
            ) : null}

            {children}
          </SidebarProvider>
        </FloatingNoteProvider>
      </CreateDialogProvider>
    </TooltipProvider>
  );
}
