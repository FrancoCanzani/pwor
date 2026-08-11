import { CaretDownIcon, CaretRightIcon, PlusIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  const [spacesOpen, setSpacesOpen] = useState(false);

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
    setSpacesOpen(true);
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
          variant="new"
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
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 text-left text-sidebar-foreground/70 hover:text-sidebar-foreground"
            aria-expanded={spacesOpen}
            onClick={() => setSpacesOpen((open) => !open)}
          >
            {spacesOpen ? (
              <CaretDownIcon className="size-3 shrink-0" />
            ) : (
              <CaretRightIcon className="size-3 shrink-0" />
            )}
            <span className="truncate">Spaces</span>
          </button>
          <button
            type="button"
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="New space"
            onClick={() => setCreateSpaceOpen(true)}
          >
            <PlusIcon className="size-3" />
          </button>
        </SidebarGroupLabel>

        {spacesOpen ? (
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
        ) : null}
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
  const { data: collections = [] } = useQuery({
    ...vaultCategoriesQueryOptions(space.id),
    enabled: isActive,
  });

  const label = space.name.trim() || "Untitled";

  return (
    <SidebarMenuItem>
      <div className="flex w-full items-center gap-0.5">
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

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                aria-label={`${label} views`}
              />
            }
          >
            <CaretDownIcon className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="min-w-36">
            <DropdownMenuItem
              className="font-normal text-xs"
              render={
                <Link
                  to="/$workspaceId"
                  params={{ workspaceId: space.id }}
                  onClick={() => setStoredWorkspaceId(space.id)}
                />
              }
            >
              All
            </DropdownMenuItem>
            <DropdownMenuItem
              className="font-normal text-xs"
              render={
                <Link
                  to="/$workspaceId/notes"
                  params={{ workspaceId: space.id }}
                  onClick={() => setStoredWorkspaceId(space.id)}
                />
              }
            >
              Notes
            </DropdownMenuItem>
            {collections.map((collection) => (
              <DropdownMenuItem
                key={collection.id}
                className="font-normal text-xs"
                render={
                  <Link
                    to="/$workspaceId/vault"
                    params={{ workspaceId: space.id }}
                    search={{ item: undefined }}
                    onClick={() => setStoredWorkspaceId(space.id)}
                  />
                }
              >
                {collection.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarMenuItem>
  );
}
