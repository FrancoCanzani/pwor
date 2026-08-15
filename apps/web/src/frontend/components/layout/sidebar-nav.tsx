import { CaretRightIcon, PlusIcon } from "@radix-ui/react-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { feedsQueryOptions } from "@features/feeds/api";
import { AddFeedDialog } from "@features/feeds/components/add-feed-dialog";
import { FeedFavicon } from "@features/feeds/components/feed-favicon";
import { updateNoteProject } from "@features/notes/api";
import { SpacePic } from "@features/spaces/components/space-pic";
import {
  inboxItemsInfiniteQueryOptions,
  updateItemProject,
} from "@features/items/api";
import { usePworItemDrop, type PworItemDrag } from "@features/items/lib/drag";
import {
  workspacesQueryOptions,
  type Workspace,
} from "@features/workspaces/api";
import { CreateWorkspaceDialog } from "@features/workspaces/components/create-workspace-dialog";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";

function NavSection({
  name,
  addLabel,
  onAdd,
  children,
}: {
  name: ReactNode;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen
      className="group/section group-data-[collapsible=icon]:hidden"
    >
      <SidebarGroup className="pt-1">
        <div className="group/header flex h-8 items-center rounded-md px-2 hover:bg-sidebar-accent">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-normal text-muted-foreground hover:text-foreground">
            <span className="truncate">{name}</span>
            <CaretRightIcon className="size-2.5 shrink-0 text-muted-foreground transition-transform in-data-open:rotate-90" />
          </CollapsibleTrigger>
          <button
            type="button"
            aria-label={addLabel}
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100 hover:text-foreground [&>svg]:size-3.5"
            onClick={onAdd}
          >
            <PlusIcon />
          </button>
        </div>
        <CollapsibleContent>
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

async function movePworItems(item: PworItemDrag, workspaceId: string | null) {
  for (const id of item.ids) {
    switch (item.kind) {
      case "item":
        await updateItemProject(id, workspaceId);
        break;
      case "note":
        await updateNoteProject(id, workspaceId);
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
  const activeFeedId = isFeeds ? segments[1] : null;

  async function handleCreated(space: { id: string }) {
    setStoredWorkspaceId(space.id);
    setCreateSpaceOpen(false);
    await queryClient.invalidateQueries({
      queryKey: workspacesQueryOptions.queryKey,
      exact: true,
    });
    await navigate({
      to: "/$workspaceId",
      params: { workspaceId: space.id },
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

      <NavSection
        name="Spaces"
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
        name="Feeds"
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
                <FeedFavicon
                  siteUrl={feed.siteUrl}
                  imageUrl={feed.imageUrl}
                  className="size-4"
                />
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
        <span className="truncate">Inbox</span>
        {inboxCount > 0 ? (
          <span className="ml-auto font-nums text-xs text-muted-foreground">
            {inboxCount}
          </span>
        ) : null}
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
            to="/$workspaceId"
            params={{ workspaceId: space.id }}
            search={{ item: undefined }}
          />
        }
      >
        <SpacePic shaderId={space.shader} className="size-4" />
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
