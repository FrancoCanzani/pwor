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
import { useFloatingNote } from "@features/notes/floating-note-context";
import {
  inboxItemsQueryOptions,
  vaultItemsQueryOptions,
} from "@features/vault/api";
import { kindLabel } from "@features/vault/lib/list";
import { feedsQueryOptions } from "@features/feeds/api";
import {
  workspacesQueryOptions,
  type Workspace,
} from "@features/workspaces/api";
import { CreateWorkspaceDialog } from "@features/workspaces/components/create-workspace-dialog";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";
import { noteDisplayTitle } from "@shared/note-frontmatter";
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
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const segments = pathname.split("/").filter(Boolean);
  const isInbox = segments[0] === "inbox";
  const isFeeds = segments[0] === "feeds";
  const routeSpaceId =
    segments[0] &&
    segments[0] !== "inbox" &&
    segments[0] !== "feeds" &&
    segments[0] !== "settings" &&
    segments[0] !== "onboarding"
      ? segments[0]
      : null;

  const ordered = useMemo(() => {
    if (!routeSpaceId) return spaces;
    const current = spaces.find((space) => space.id === routeSpaceId);
    const rest = spaces.filter((space) => space.id !== routeSpaceId);
    return current ? [current, ...rest] : spaces;
  }, [spaces, routeSpaceId]);

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

  const { data: inboxList } = useQuery(inboxItemsQueryOptions());
  const inboxCount = inboxList?.items.length ?? 0;
  const { data: feeds = [] } = useQuery(feedsQueryOptions());
  const feedsUnread = feeds.reduce(
    (sum, feed) => sum + (feed.unreadCount ?? 0),
    0,
  );
  const activeFeedId = isFeeds ? segments[1] : null;

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isInbox}
                render={<Link to="/inbox" />}
                className="font-normal"
              >
                <span className="truncate">Inbox</span>
                {inboxCount > 0 ? (
                  <span className="ml-auto font-nums text-xs text-muted-foreground">
                    {inboxCount}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="relative">
        <SidebarGroupLabel className="mb-1.5 font-mono text-sm font-normal tracking-wide uppercase">
          Spaces
        </SidebarGroupLabel>
        <SidebarGroupAction
          aria-label="New space"
          className="top-2.5 [&_svg]:size-4"
          onClick={() => setCreateSpaceOpen(true)}
        >
          <PlusIcon />
        </SidebarGroupAction>

        <SidebarGroupContent className="pt-1.5">
          <SidebarMenu className="gap-1">
            {ordered.map((space) => (
              <SpaceRow
                key={space.id}
                space={space}
                isActive={space.id === routeSpaceId}
                onSelect={() => selectSpace(space.id)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="relative">
        <SidebarGroupLabel className="mb-1.5 font-mono text-sm font-normal tracking-wide uppercase">
          Feeds
        </SidebarGroupLabel>
        <SidebarGroupAction
          aria-label="Add feed"
          className="top-2.5 [&_svg]:size-4"
          render={<Link to="/feeds" search={{ item: undefined }} />}
        >
          <PlusIcon />
        </SidebarGroupAction>
        <SidebarGroupContent className="pt-1.5">
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isFeeds && !activeFeedId}
                render={<Link to="/feeds" search={{ item: undefined }} />}
                className="font-normal"
              >
                <span className="truncate">All</span>
                {feedsUnread > 0 ? (
                  <span className="ml-auto font-nums text-xs text-muted-foreground">
                    {feedsUnread}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
            {feeds.map((feed) => (
              <SidebarMenuItem key={feed.id}>
                <SidebarMenuButton
                  isActive={activeFeedId === feed.id}
                  render={
                    <Link
                      to="/feeds/$feedId"
                      params={{ feedId: feed.id }}
                      search={{ item: undefined }}
                    />
                  }
                  className="font-normal"
                >
                  <span className="truncate">
                    {feed.title?.trim() || feed.siteName || "Feed"}
                  </span>
                  {(feed.unreadCount ?? 0) > 0 ? (
                    <span className="ml-auto font-nums text-xs text-muted-foreground">
                      {feed.unreadCount}
                    </span>
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const search = useRouterState({
    select: (state) => state.location.search as { item?: string },
  });
  const { openNote, activeNoteId } = useFloatingNote();

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
        title: noteDisplayTitle(note.title),
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
        className="font-normal"
        tooltip={label}
        onClick={onSelect}
      >
        <SpacePic shaderId={space.shader} className="size-5" />
        <span>{label}</span>
      </SidebarMenuButton>

      {hasChildren ? (
        <CollapsibleTrigger
          render={<SidebarMenuAction showOnHover />}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        >
          <ChevronRightIcon className="size-3.5 transition-transform group-data-open/collapsible:rotate-90" />
        </CollapsibleTrigger>
      ) : null}

      {hasChildren ? (
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 min-w-0 gap-0.5 pr-0">
            {recent.map((row) => {
              if (row.kind === "note") {
                const active = activeNoteId === row.noteId;
                return (
                  <SidebarMenuSubItem key={row.key} className="w-full">
                    <SidebarMenuSubButton
                      isActive={active}
                      className="h-7 w-full justify-start gap-2 text-left text-sm font-normal text-muted-foreground"
                      render={
                        <button
                          type="button"
                          className="flex w-full items-center justify-start text-left"
                          onClick={() => {
                            setStoredWorkspaceId(space.id);
                            if (!isActive) {
                              void navigate({
                                to: "/$workspaceId",
                                params: { workspaceId: space.id },
                              });
                            }
                            openNote(row.noteId);
                          }}
                        />
                      }
                    >
                      <span className="min-w-0 flex-1 truncate text-left">
                        {row.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground opacity-70">
                        note
                      </span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              }

              const active = isActive && search.item === row.itemId;
              return (
                <SidebarMenuSubItem key={row.key} className="w-full">
                  <SidebarMenuSubButton
                    isActive={active}
                    className="h-7 w-full justify-start gap-2 text-left text-sm font-normal text-muted-foreground"
                    render={
                      <Link
                        to="/$workspaceId"
                        params={{ workspaceId: space.id }}
                        search={{ item: row.itemId }}
                        className="flex w-full items-center justify-start text-left"
                        onClick={() => setStoredWorkspaceId(space.id)}
                      />
                    }
                  >
                    <span className="min-w-0 flex-1 truncate text-left">
                      {row.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground opacity-70">
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
