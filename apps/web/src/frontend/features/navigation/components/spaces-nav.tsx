import { ChevronRightIcon, PlusIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
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

      <SidebarGroup className="relative">
        <SidebarGroupLabel className="font-mono text-[10px] font-normal tracking-wide uppercase">
          Spaces
        </SidebarGroupLabel>
        <SidebarGroupAction
          aria-label="New space"
          onClick={() => setCreateSpaceOpen(true)}
        >
          <PlusIcon />
        </SidebarGroupAction>

        <SidebarGroupContent>
          <SidebarMenu>
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
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
      render={<SidebarMenuItem />}
    >
      <SidebarMenuButton
        isActive={isActive}
        size="sm"
        className="font-normal"
        tooltip={label}
        onClick={onSelect}
      >
        <SpacePic shaderId={space.shader} />
        <span>{label}</span>
      </SidebarMenuButton>

      <CollapsibleTrigger
        render={<SidebarMenuAction showOnHover />}
        aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
      >
        <ChevronRightIcon className="transition-transform group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <SidebarMenuSub>
          {collections.map((collection) => {
            const active = isActive && search.category === collection.id;
            return (
              <SidebarMenuSubItem key={collection.id}>
                <SidebarMenuSubButton
                  size="sm"
                  isActive={active}
                  className="font-normal"
                  render={
                    <Link
                      to="/$workspaceId/vault"
                      params={{ workspaceId: space.id }}
                      search={{ category: collection.id }}
                      onClick={() => setStoredWorkspaceId(space.id)}
                    />
                  }
                >
                  <span>{collection.name}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
