import { PlusIcon } from "@radix-ui/react-icons";
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
  const activeLeaf = segments[1]; // notes | vault | undefined (library)

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

              return (
                <SpaceRow
                  key={space.id}
                  space={space}
                  isActive={isActive}
                  activeLeaf={isActive ? activeLeaf : undefined}
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
  activeLeaf,
  onSelect,
}: {
  space: Workspace;
  isActive: boolean;
  activeLeaf: string | undefined;
  onSelect: () => void;
}) {
  const { data: collections = [] } = useQuery({
    ...vaultCategoriesQueryOptions(space.id),
    enabled: isActive,
  });

  const label = space.name.trim() || "Untitled";
  const onLibrary = isActive && !activeLeaf;
  const onNotes = isActive && activeLeaf === "notes";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        size="sm"
        className="font-normal"
        tooltip={label}
        onClick={onSelect}
      >
        <SpacePic spaceId={space.id} />
        <span className="truncate">{label}</span>
      </SidebarMenuButton>

      {isActive ? (
        <SidebarMenuSub className="ml-3 border-l border-border/60">
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              render={
                <Link
                  to="/$workspaceId"
                  params={{ workspaceId: space.id }}
                />
              }
              isActive={onLibrary}
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
              isActive={onNotes}
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
