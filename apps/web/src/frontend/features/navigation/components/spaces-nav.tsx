import { ChevronRightIcon, PlusIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

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
import { notesQueryOptions } from "@features/notes/api";
import { vaultItemsQueryOptions } from "@features/vault/api";
import { kindLabel } from "@features/vault/lib/list";
import {
  workspacesQueryOptions,
  type Workspace,
} from "@features/workspaces/api";
import { CreateWorkspaceDialog } from "@features/workspaces/components/create-workspace-dialog";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";
import { toEpochMs } from "@shared/time";

type RecentRow =
  | {
      key: string;
      kind: "note";
      title: string;
      noteId: string;
      at: number;
    }
  | {
      key: string;
      kind: "vault";
      title: string;
      itemId: string;
      label: string;
      at: number;
    };

export function SpacesNav() {
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
      <SidebarGroup className="relative">
        <SidebarGroupLabel className="mb-1 font-mono text-sm font-normal tracking-wide uppercase">
          Spaces
        </SidebarGroupLabel>
        <SidebarGroupAction
          aria-label="New space"
          onClick={() => setCreateSpaceOpen(true)}
        >
          <PlusIcon />
        </SidebarGroupAction>

        <SidebarGroupContent className="pt-1">
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
    select: (state) => state.location.search as { item?: string },
  });

  const { data: notes = [] } = useQuery({
    ...notesQueryOptions(space.id),
    enabled: open || isActive,
  });
  const { data: vaultList } = useQuery({
    ...vaultItemsQueryOptions(space.id),
    enabled: open || isActive,
  });
  const vaultItems = vaultList?.items ?? [];

  const recent = useMemo(() => {
    const rows: RecentRow[] = [];
    for (const note of notes) {
      rows.push({
        key: `note:${note.id}`,
        kind: "note",
        title: note.title?.trim() || "Untitled",
        noteId: note.id,
        at: toEpochMs(note.updatedAt),
      });
    }
    for (const item of vaultItems) {
      rows.push({
        key: `vault:${item.id}`,
        kind: "vault",
        title: item.title?.trim() || "Untitled",
        itemId: item.id,
        label: kindLabel(item),
        at: toEpochMs(item.createdAt),
      });
    }
    rows.sort((a, b) => b.at - a.at);
    return rows.slice(0, 5);
  }, [notes, vaultItems]);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const label = space.name.trim() || "Untitled";
  const hasChildren = recent.length > 0;

  return (
    <Collapsible
      open={open && hasChildren}
      onOpenChange={(next) => {
        if (!hasChildren) return;
        setOpen(next);
      }}
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

      {hasChildren ? (
        <CollapsibleTrigger
          render={
            <SidebarMenuAction showOnHover className="!size-4 !w-4" />
          }
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        >
          <ChevronRightIcon className="!size-3 transition-transform group-data-open/collapsible:rotate-90" />
        </CollapsibleTrigger>
      ) : null}

      {hasChildren ? (
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 min-w-0 pr-0">
            {recent.map((row) => {
              if (row.kind === "note") {
                return (
                  <SidebarMenuSubItem key={row.key} className="w-full">
                    <SidebarMenuSubButton
                      size="sm"
                      className="h-6 w-full flex-1 text-[11px] font-normal text-muted-foreground"
                      render={
                        <Link
                          to="/$workspaceId/notes/$noteId"
                          params={{
                            workspaceId: space.id,
                            noteId: row.noteId,
                          }}
                          onClick={() => setStoredWorkspaceId(space.id)}
                        />
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{row.title}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              }

              const active = isActive && search.item === row.itemId;
              return (
                <SidebarMenuSubItem key={row.key} className="w-full">
                  <SidebarMenuSubButton
                    size="sm"
                    isActive={active}
                    className="h-6 w-full flex-1 text-[11px] font-normal text-muted-foreground"
                    render={
                      <Link
                        to="/$workspaceId"
                        params={{ workspaceId: space.id }}
                        search={{ item: row.itemId }}
                        onClick={() => setStoredWorkspaceId(space.id)}
                      />
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{row.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] opacity-70">
                      {row.label}
                    </span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}
