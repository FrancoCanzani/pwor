import { CaretDownIcon, CaretRightIcon, PlusIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SpacePic } from "@features/navigation/components/space-pic";
import { vaultCategoriesQueryOptions } from "@features/vault/api";
import {
  workspacesQueryOptions,
  type Workspace,
} from "@features/workspaces/api";
import { CreateWorkspaceDialog } from "@features/workspaces/components/create-workspace-dialog";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

export function SpacesNav({ onCreate }: { onCreate: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);
  const { id: currentId } = useCurrentWorkspace();
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const segments = pathname.split("/").filter(Boolean);
  const activeSpaceId = segments[0] || currentId;

  const ordered = useMemo(() => {
    if (!activeSpaceId) return spaces;
    const current = spaces.find((space) => space.id === activeSpaceId);
    const rest = spaces.filter((space) => space.id !== activeSpaceId);
    return current ? [current, ...rest] : spaces;
  }, [spaces, activeSpaceId]);

  function selectSpace(id: string) {
    setStoredWorkspaceId(id);
    void navigate({
      to: "/$workspaceId",
      params: { workspaceId: id },
    });
  }

  async function handleCreated(space: Workspace) {
    setStoredWorkspaceId(space.id);
    setCreateSpaceOpen(false);
    await queryClient.invalidateQueries({
      queryKey: workspacesQueryOptions.queryKey,
      exact: true,
    });
    await navigate({
      to: "/$workspaceId",
      params: { workspaceId: space.id },
    });
  }

  return (
    <>
      <SidebarGroup className="px-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="h-8 w-full justify-start gap-2 px-2 text-xs font-normal"
          onClick={onCreate}
        >
          <PlusIcon className="size-3.5" />
          Create new
          <kbd className="ml-auto rounded-sm border border-border/60 px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
            ⌘N
          </kbd>
        </Button>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-1 px-2 font-normal">
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-wide text-sidebar-foreground/70">
            Spaces
          </span>
          <button
            type="button"
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="New space"
            onClick={() => setCreateSpaceOpen(true)}
          >
            <PlusIcon className="size-3" />
          </button>
        </SidebarGroupLabel>

        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {ordered.map((space) => (
              <SpaceRow
                key={space.id}
                space={space}
                isActive={space.id === activeSpaceId}
                onSelect={() => selectSpace(space.id)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <CreateWorkspaceDialog
        open={createSpaceOpen}
        onOpenChange={setCreateSpaceOpen}
        onCreated={handleCreated}
      />
    </>
  );
}

function SpaceRow({
  space,
  isActive,
  onSelect,
}: {
  space: Workspace;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(isActive);
  const search = useRouterState({
    select: (state) => state.location.search as { category?: string },
  });
  const { data: collections = [] } = useQuery({
    ...vaultCategoriesQueryOptions(space.id),
    enabled: open,
  });

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const label = space.name.trim() || "Untitled";

  return (
    <SidebarMenuItem>
      <div className="flex w-full items-center gap-0.5">
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-expanded={open}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <CaretDownIcon className="size-3" />
          ) : (
            <CaretRightIcon className="size-3" />
          )}
        </button>

        <SidebarMenuButton
          isActive={isActive}
          size="sm"
          className="min-w-0 flex-1 font-normal"
          tooltip={label}
          onClick={onSelect}
        >
          <SpacePic shaderId={space.shader} />
          <span className="truncate">{label}</span>
        </SidebarMenuButton>
      </div>

      {open ? (
        <SidebarMenuSub className="mx-2 ml-4 border-sidebar-border/60">
          {collections.map((collection) => {
            const active =
              isActive && search.category === collection.id;
            return (
              <SidebarMenuSubItem key={collection.id}>
                <SidebarMenuSubButton
                  size="sm"
                  isActive={active}
                  className={cn("font-normal", active && "data-active:bg-sidebar-accent")}
                  render={
                    <Link
                      to="/$workspaceId/vault"
                      params={{ workspaceId: space.id }}
                      search={{ category: collection.id }}
                      onClick={() => setStoredWorkspaceId(space.id)}
                    />
                  }
                >
                  <span className="truncate">{collection.name}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}
