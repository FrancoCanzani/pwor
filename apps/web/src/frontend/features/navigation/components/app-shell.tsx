import { PlusIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import { packsQueryOptions, type Pack } from "@features/packs/api";
import { CreatePackDialog } from "@features/packs/components/create-pack-dialog";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: currentWorkspaceId } = useCurrentWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: packs = [] } = useQuery({
    ...packsQueryOptions(currentWorkspaceId),
    enabled: Boolean(currentWorkspaceId),
  });

  const activePackId = pathname.match(/\/packs\/([^/]+)/)?.[1];
  const onPackDetail = Boolean(activePackId);

  async function handleCreated(pack: Pack) {
    if (!currentWorkspaceId) return;
    await queryClient.invalidateQueries({
      queryKey: packsQueryOptions(currentWorkspaceId).queryKey,
    });
    await navigate({
      to: "/$workspaceId/packs/$packId",
      params: { workspaceId: currentWorkspaceId, packId: pack.id },
    });
  }

  return (
    <TooltipProvider>
      <SidebarProvider className={cn(onPackDetail && "h-svh min-h-0 overflow-hidden")}>
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
              <SidebarGroupLabel className="flex items-center justify-between gap-2 font-normal">
                {currentWorkspaceId ? (
                  <Link
                    to="/$workspaceId"
                    params={{ workspaceId: currentWorkspaceId }}
                    className={cn(
                      "truncate text-sidebar-foreground/70 no-underline hover:text-sidebar-foreground",
                      !activePackId && "text-sidebar-foreground",
                    )}
                  >
                    All packs
                  </Link>
                ) : (
                  <span>All packs</span>
                )}
                {currentWorkspaceId ? (
                  <button
                    type="button"
                    aria-label="New pack"
                    className="rounded-sm p-0.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
                    onClick={() => setCreateOpen(true)}
                  >
                    <PlusIcon className="size-3.5" />
                  </button>
                ) : null}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {currentWorkspaceId
                    ? packs.map((pack) => (
                        <SidebarMenuItem key={pack.id}>
                          <SidebarMenuButton
                            render={
                              <Link
                                to="/$workspaceId/packs/$packId"
                                params={{
                                  workspaceId: currentWorkspaceId,
                                  packId: pack.id,
                                }}
                              />
                            }
                            isActive={activePackId === pack.id}
                            tooltip={pack.name}
                            size="sm"
                          >
                            <span className="truncate">{pack.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))
                    : null}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <NavUser user={user} />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className={cn(onPackDetail && "h-full min-h-0 overflow-hidden")}>
          <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1 md:hidden">
            <SidebarTrigger />
            <span className="font-pixel text-base leading-none tracking-tight">
              Pwor
            </span>
          </div>
          {onPackDetail ? (
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          ) : (
            children
          )}
        </SidebarInset>
      </SidebarProvider>

      {currentWorkspaceId ? (
        <CreatePackDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceId={currentWorkspaceId}
          onCreated={handleCreated}
        />
      ) : null}
    </TooltipProvider>
  );
}
