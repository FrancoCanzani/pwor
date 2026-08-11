import { useHotkey } from "@tanstack/react-hotkeys";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@features/command/components/command-palette";
import { CreateDialog } from "@features/command/components/create-dialog";
import { CreateDialogProvider } from "@features/command/create-dialog-context";
import { FloatingNoteHost } from "@features/notes/components/floating-note-window";
import { FloatingNoteProvider } from "@features/notes/floating-note-context";
import { SpacesNav } from "@features/navigation/components/spaces-nav";
import {
  NavUser,
  type ShellUser,
} from "@features/navigation/components/nav-user";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const segments = pathname.split("/").filter(Boolean);
  const isSettings = segments[0] === "settings";
  const isFlush = !isSettings;
  const { id: workspaceId } = useCurrentWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [floatingNoteId, setFloatingNoteId] = useState<string | null>(null);

  function openCreate() {
    if (!workspaceId) return;
    setCreateOpen(true);
  }

  function openNewNote() {
    if (!workspaceId) return;
    setFloatingNoteId(null);
    setFloatingOpen(true);
  }

  function openNote(noteId: string) {
    if (!workspaceId) return;
    setFloatingNoteId(noteId);
    setFloatingOpen(true);
  }

  useHotkey("Mod+N", () => openNewNote(), { enabled: Boolean(workspaceId) });

  return (
    <TooltipProvider>
      <CreateDialogProvider value={{ open: openCreate }}>
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

            <Sidebar collapsible="icon">
              <SidebarHeader className="h-12 flex-row items-center gap-0 border-b border-sidebar-border/40 p-2">
                <Link
                  to="/"
                  className="px-2 font-pixel text-base leading-none font-normal tracking-tight text-sidebar-foreground no-underline group-data-[collapsible=icon]:hidden"
                >
                  Pwor
                </Link>
              </SidebarHeader>

              <SidebarContent>
                <SpacesNav />
              </SidebarContent>

              <SidebarFooter>
                <NavUser user={user} />
              </SidebarFooter>
            </Sidebar>

            <SidebarInset
              className={cn(isFlush && "h-full min-h-0 overflow-hidden")}
            >
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-3 md:hidden">
                <SidebarTrigger />
                <span className="font-pixel text-base leading-none tracking-tight">
                  Pwor
                </span>
              </div>
              {isFlush ? (
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
              ) : (
                <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-20">
                  {children}
                </div>
              )}
            </SidebarInset>
          </SidebarProvider>
        </FloatingNoteProvider>
      </CreateDialogProvider>
    </TooltipProvider>
  );
}
