import { useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@features/command/components/command-palette";
import { CaptureComposer } from "@features/command/components/capture-composer";
import { CommandPaletteProvider } from "@features/command/command-palette-context";
import {
  CaptureComposerProvider,
  type CaptureDraft,
} from "@features/command/capture-composer-context";
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
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [floatingNoteId, setFloatingNoteId] = useState<string | null>(null);

  function openNote(noteId: string) {
    if (!workspaceId) return;
    void queryClient.prefetchQuery(noteQueryOptions(noteId));
    setFloatingNoteId(noteId);
    setFloatingOpen(true);
  }

  useHotkey("Mod+U", () => setCreateOpen(true));

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <CaptureComposerProvider
          value={{
            open: (next) => {
              setCreateOpen(true);
              if (next) setDraft({ ...next });
            },
            isOpen: createOpen,
          }}
        >
          <CommandPaletteProvider value={{ open: () => setPaletteOpen(true) }}>
            <FloatingNoteProvider
              value={{
                openNote,
                activeNoteId: floatingOpen ? floatingNoteId : null,
              }}
            >
              <SidebarProvider
                className={cn(
                  "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
                  isFlush && "h-dvh min-h-0 overflow-hidden",
                )}
              >
                <CommandPalette
                  open={paletteOpen}
                  onOpenChange={setPaletteOpen}
                />
                <PasteCapture />
                <CaptureComposer
                  open={createOpen}
                  onOpenChange={(next) => {
                    setCreateOpen(next);
                    if (!next) setDraft(null);
                  }}
                  draft={draft}
                />
                {floatingOpen && floatingNoteId ? (
                  <FloatingNoteHost
                    noteId={floatingNoteId}
                    onClose={() => {
                      setFloatingOpen(false);
                      setFloatingNoteId(null);
                    }}
                  />
                ) : null}

                {children}
              </SidebarProvider>
            </FloatingNoteProvider>
          </CommandPaletteProvider>
        </CaptureComposerProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
