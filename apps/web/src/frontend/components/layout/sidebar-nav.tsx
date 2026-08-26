import { PlusIcon } from "@radix-ui/react-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { feedsQueryOptions } from "@features/feeds/api";
import { AddFeedDialog } from "@features/feeds/components/add-feed-dialog";
import { updateNoteWorkspace } from "@features/notes/api";
import {
  inboxItemsInfiniteQueryOptions,
  updateItemWorkspace,
} from "@features/items/api";
import { usePworItemDrop, type PworItemDrag } from "@features/items/lib/drag";
import {
  workspacesQueryOptions,
  type Workspace,
} from "@features/workspaces/api";
import { CreateWorkspaceDialog } from "@features/workspaces/components/create-workspace-dialog";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";

function NavSection({
  addLabel,
  onAdd,
  children,
}: {
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <SidebarGroup className="group/section relative pt-1 group-data-[collapsible=icon]:hidden">
      <button
        type="button"
        aria-label={addLabel}
        className="absolute top-1.5 right-2 z-10 flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/section:opacity-100 group-focus-within/section:opacity-100 hover:text-foreground [&>svg]:size-3.5"
        onClick={onAdd}
      >
        <PlusIcon />
      </button>
      <SidebarGroupContent>{children}</SidebarGroupContent>
    </SidebarGroup>
  );
}

async function movePworItems(item: PworItemDrag, workspaceId: string | null) {
  for (const id of item.ids) {
    switch (item.kind) {
      case "item":
        await updateItemWorkspace(id, workspaceId);
        break;
      case "note":
        await updateNoteWorkspace(id, workspaceId);
        break;
      default: {
        const _exhaustive: never = item.kind;
        return _exhaustive;
      }
    }
  }
}

function movedToast(item: PworItemDrag, destination: string) {
  const count = item.ids.length;
  toast.success(
    count > 1 ? `Moved ${count} to ${destination}` : `Moved to ${destination}`,
  );
}

export function SidebarNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);
  const { data: feeds = [] } = useQuery(feedsQueryOptions());
  const { data: inboxList } = useInfiniteQuery(
    inboxItemsInfiniteQueryOptions(),
  );
  const inboxCount = inboxList?.pages[0]?.total ?? 0;
  const feedsUnread = feeds.reduce(
    (sum, feed) => sum + (feed.unreadCount ?? 0),
    0,
  );

  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [addFeedOpen, setAddFeedOpen] = useState(false);

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { spaceId: routeSpaceId, feedId: activeFeedId } = useParams({
    strict: false,
  });
  const isInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");
  const isNotes = pathname === "/notes" || pathname.startsWith("/notes/");
  const isFeeds = pathname === "/feeds" || pathname.startsWith("/feeds/");

  async function handleCreated(space: { id: string }) {
    setStoredWorkspaceId(space.id);
    setCreateSpaceOpen(false);
    await queryClient.invalidateQueries({
      queryKey: workspacesQueryOptions.queryKey,
      exact: true,
    });
    await navigate({
      to: "/spaces/$spaceId",
      params: { spaceId: space.id },
      search: { item: undefined },
    });
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <InboxRow inboxCount={inboxCount} isActive={isInbox} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <NotesRow isActive={isNotes} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <NavSection
        addLabel="New space"
        onAdd={() => setCreateSpaceOpen(true)}
      >
        <SidebarMenu className="max-h-72 gap-0.5 overflow-y-auto">
          {spaces.map((space) => (
            <SpaceRow
              key={space.id}
              space={space}
              isActive={space.id === routeSpaceId}
            />
          ))}
        </SidebarMenu>
      </NavSection>

      <NavSection
        addLabel="Add feed"
        onAdd={() => setAddFeedOpen(true)}
      >
        <SidebarMenu className="max-h-72 gap-0.5 overflow-y-auto">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isFeeds && !activeFeedId}
              render={<Link to="/feeds" search={{ item: undefined }} />}
              className="font-normal"
            >
              <span className="min-w-0 truncate">All</span>
              {feedsUnread > 0 ? (
                <span className="ml-auto shrink-0 font-nums text-xs text-muted-foreground">
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
                <span className="min-w-0 truncate">
                  {feed.title?.trim() || feed.siteName || "Feed"}
                </span>
                {(feed.unreadCount ?? 0) > 0 ? (
                  <span className="ml-auto shrink-0 font-nums text-xs text-muted-foreground">
                    {feed.unreadCount}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </NavSection>

      <CreateWorkspaceDialog
        open={createSpaceOpen}
        onOpenChange={setCreateSpaceOpen}
        onCreated={handleCreated}
      />

      <AddFeedDialog
        open={addFeedOpen}
        onOpenChange={setAddFeedOpen}
        onCreated={(feed) =>
          navigate({
            to: "/feeds/$feedId",
            params: { feedId: feed.id },
            search: { item: undefined },
          })
        }
      />
    </>
  );
}

function InboxRow({
  inboxCount,
  isActive,
}: {
  inboxCount: number;
  isActive: boolean;
}) {
  const queryClient = useQueryClient();

  const moveMutation = useMutation({
    mutationFn: (item: PworItemDrag) => movePworItems(item, null),
    onSuccess: async (_result, item) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      movedToast(item, "Inbox");
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const { isOver, dropProps } = usePworItemDrop({
    canDrop: (item) => item.kind === "item" && item.fromWorkspaceId !== null,
    onDrop: (item) => moveMutation.mutate(item),
  });

  return (
    <SidebarMenuItem
      {...dropProps}
      className={cn("rounded-md", isOver && "bg-sidebar-accent")}
    >
      <SidebarMenuButton
        isActive={isActive}
        render={<Link to="/inbox" />}
        className="font-normal"
      >
        <span className="min-w-0 truncate">Inbox</span>
        {inboxCount > 0 ? (
          <span className="ml-auto shrink-0 font-nums text-xs text-muted-foreground">
            {inboxCount}
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NotesRow({ isActive }: { isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={<Link to="/notes" />}
        className="font-normal"
      >
        <span className="min-w-0 truncate">Notes</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SpaceRow({
  space,
  isActive,
}: {
  space: Workspace;
  isActive: boolean;
}) {
  const queryClient = useQueryClient();
  const label = space.name.trim() || "Untitled";

  const moveMutation = useMutation({
    mutationFn: (item: PworItemDrag) => movePworItems(item, space.id),
    onSuccess: async (_result, item) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      movedToast(item, label);
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const { isOver, dropProps } = usePworItemDrop({
    canDrop: (item) => item.fromWorkspaceId !== space.id,
    onDrop: (item) => moveMutation.mutate(item),
  });

  return (
    <SidebarMenuItem
      {...dropProps}
      className={cn(isOver && "bg-sidebar-accent")}
    >
      <SidebarMenuButton
        isActive={isActive}
        className="font-normal"
        tooltip={label}
        render={
          <Link
            to="/spaces/$spaceId"
            params={{ spaceId: space.id }}
            search={{ item: undefined }}
          />
        }
      >
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
