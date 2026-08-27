import { CaretRightIcon, PlusIcon } from "@radix-ui/react-icons";
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
import { updateNotes } from "@features/notes/api";
import {
  inboxItemsInfiniteQueryOptions,
  updateItems,
} from "@features/items/api";
import { usePworItemDrop, type PworItemDrag } from "@features/items/lib/drag";
import {
  spacesQueryOptions,
  type Space,
} from "@features/spaces/api";
import { CaptureButton } from "@features/command/components/capture-button";
import { CreateSpaceDialog } from "@features/spaces/components/create-space-dialog";
import { setStoredSpaceId } from "@features/spaces/lib/current-space";

function NavSection({
  name,
  addLabel,
  onAdd,
  children,
}: {
  name: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen className="group/section">
      <SidebarGroup className="pt-1">
        <div className="group/header flex h-8 items-center rounded-md px-2 hover:bg-sidebar-accent">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-normal text-muted-foreground hover:text-foreground">
            <span className="truncate">{name}</span>
            <CaretRightIcon className="size-2.5 shrink-0 text-muted-foreground transition-transform in-data-open:rotate-90" />
          </CollapsibleTrigger>
          <button
            type="button"
            aria-label={addLabel}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100 hover:text-foreground [&>svg]:size-3.5"
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

async function movePworItems(item: PworItemDrag, spaceId: string | null) {
  switch (item.kind) {
    case "item":
      await updateItems(item.ids, { spaceId });
      return;
    case "note":
      await updateNotes(item.ids, { spaceId });
      return;
    default: {
      const _exhaustive: never = item.kind;
      return _exhaustive;
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
  const { data: spaces = [] } = useQuery(spacesQueryOptions);
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
    setStoredSpaceId(space.id);
    setCreateSpaceOpen(false);
    await queryClient.invalidateQueries({
      queryKey: spacesQueryOptions.queryKey,
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
      <SidebarGroup className="gap-2">
        <CaptureButton />
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
              <span className="min-w-0 truncate">All</span>
              {feedsUnread > 0 ? (
                <span className="ml-auto flex size-6 shrink-0 items-center justify-end font-nums text-xs text-muted-foreground">
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
                  <span className="ml-auto flex size-6 shrink-0 items-center justify-end font-nums text-xs text-muted-foreground">
                    {feed.unreadCount}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </NavSection>

      <CreateSpaceDialog
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
        queryClient.invalidateQueries({ queryKey: ["spaces"] }),
      ]);
      movedToast(item, "Inbox");
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const { isOver, dropProps } = usePworItemDrop({
    canDrop: (item) => item.kind === "item" && item.fromSpaceId !== null,
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
          <span className="ml-auto flex size-6 shrink-0 items-center justify-end font-nums text-xs text-muted-foreground">
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
  space: Space;
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
        queryClient.invalidateQueries({ queryKey: ["spaces"] }),
      ]);
      movedToast(item, label);
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const { isOver, dropProps } = usePworItemDrop({
    canDrop: (item) => item.fromSpaceId !== space.id,
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
