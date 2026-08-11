import { CaretDownIcon, CaretRightIcon, PlusIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const activeSpaceId = pathname.split("/")[1] || currentId;

  const ordered = useMemo(() => {
    if (!currentId) return spaces;
    const current = spaces.find((space) => space.id === currentId);
    const rest = spaces.filter((space) => space.id !== currentId);
    return current ? [current, ...rest] : spaces;
  }, [spaces, currentId]);

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
        <SidebarGroupLabel className="flex items-center justify-between font-normal">
          Spaces
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
            {ordered.map((space) => {
              const isActive = space.id === activeSpaceId;
              const isOpen = expanded[space.id] ?? isActive;

              return (
                <SpaceRow
                  key={space.id}
                  space={space}
                  isActive={isActive}
                  isOpen={isOpen}
                  onToggle={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [space.id]: !isOpen,
                    }))
                  }
                  onSelect={() => selectSpace(space.id)}
                />
              );
            })}
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
  isOpen,
  onToggle,
  onSelect,
}: {
  space: Workspace;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const { data: collections = [] } = useQuery({
    ...vaultCategoriesQueryOptions(space.id),
    enabled: isOpen,
  });

  return (
    <SidebarMenuItem>
      <div className="flex w-full items-center gap-0.5">
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={isOpen ? "Collapse space" : "Expand space"}
          onClick={onToggle}
        >
          {isOpen ? (
            <CaretDownIcon className="size-3" />
          ) : (
            <CaretRightIcon className="size-3" />
          )}
        </button>
        <SidebarMenuButton
          isActive={isActive}
          size="sm"
          className="min-w-0 flex-1 font-normal"
          onClick={onSelect}
        >
          <span className="truncate">{space.name.trim() || "Untitled"}</span>
        </SidebarMenuButton>
      </div>

      {isOpen ? (
        <SidebarMenuSub className="ml-3 border-l border-border/60">
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              render={
                <Link
                  to="/$workspaceId"
                  params={{ workspaceId: space.id }}
                />
              }
              isActive={isActive}
              size="sm"
              className="font-normal"
            >
              All
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              render={
                <Link
                  to="/$workspaceId/notes"
                  params={{ workspaceId: space.id }}
                />
              }
              size="sm"
              className="font-normal"
            >
              Notes
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          {collections.map((collection) => (
            <SidebarMenuSubItem key={collection.id}>
              <SidebarMenuSubButton
                render={
                  <Link
                    to="/$workspaceId/vault"
                    params={{ workspaceId: space.id }}
                    search={{ item: undefined }}
                  />
                }
                size="sm"
                className="font-normal"
              >
                {collection.name}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}
