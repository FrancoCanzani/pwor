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
import {
  CreateDialogProvider,
  type CreateDialogLaunch,
} from "@features/command/create-dialog-context";
import { SpacesNav } from "@features/navigation/components/spaces-nav";
import {
  NavUser,
  type ShellUser,
} from "@features/navigation/components/nav-user";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [createLaunch, setCreateLaunch] = useState<CreateDialogLaunch | null>(
    null,
  );

  function openCreate(launch?: CreateDialogLaunch) {
    setCreateLaunch(launch ?? null);
    setCreateOpen(true);
  }

  useHotkey("Mod+N", () => openCreate());

  return (
    <TooltipProvider>
      <CreateDialogProvider value={{ open: openCreate }}>
        <SidebarProvider
          className={cn(isFlush && "h-svh min-h-0 overflow-hidden")}
        >
          <CommandPalette />
          <CreateDialog
            open={createOpen}
            launch={createLaunch}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) setCreateLaunch(null);
            }}
          />

          <Sidebar collapsible="icon">
            <SidebarHeader className="h-12 flex-row items-center gap-0 p-2">
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
            <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1 md:hidden">
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
      </CreateDialogProvider>
    </TooltipProvider>
  );
}
