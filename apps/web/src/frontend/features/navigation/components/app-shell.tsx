import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@features/command/components/command-palette";
import {
  NavUser,
  type ShellUser,
} from "@features/navigation/components/nav-user";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

const navItems = [
  { to: "/$workspaceId/inbox", segment: "inbox", label: "Inbox" },
  { to: "/$workspaceId/tasks", segment: "tasks", label: "Tasks" },
  { to: "/$workspaceId/calendar", segment: "calendar", label: "Calendar" },
  { to: "/$workspaceId/notes", segment: "notes", label: "Notes" },
  { to: "/$workspaceId/vault", segment: "vault", label: "Vault" },
  { to: "/$workspaceId/log", segment: "log", label: "Updates" },
] as const;

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
  const activeSegment = pathname.split("/")[2];
  const isNotes = activeSegment === "notes";
  const isVault = activeSegment === "vault";
  const isTasks = activeSegment === "tasks";
  const isCalendar = activeSegment === "calendar";
  const isLogFeed = activeSegment === "log";
  const isFlush = isNotes || isVault || isTasks || isCalendar || isLogFeed;

  const { id: currentWorkspaceId } = useCurrentWorkspace();

  return (
    <TooltipProvider>
      <SidebarProvider
        className={cn(isFlush && "h-svh min-h-0 overflow-hidden")}
      >
        <CommandPalette />

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
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {currentWorkspaceId
                    ? navItems.map((item) => {
                        const isActive = activeSegment === item.segment;

                        return (
                          <SidebarMenuItem key={item.to}>
                            <SidebarMenuButton
                              render={
                                <Link
                                  to={item.to}
                                  params={{ workspaceId: currentWorkspaceId }}
                                />
                              }
                              isActive={isActive}
                              tooltip={item.label}
                              size="sm"
                            >
                              {item.label}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })
                    : null}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
          {isNotes || isVault || isTasks || isCalendar ? (
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          ) : isLogFeed ? (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-8 pt-10">
              {children}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-20">
              {children}
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
