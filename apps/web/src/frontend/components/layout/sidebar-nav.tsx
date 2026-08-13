import { DotsHorizontalIcon, PlusIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { feedsQueryOptions } from "@features/feeds/api";
import { AddFeedDialog } from "@features/feeds/components/add-feed-dialog";
import { FeedFavicon } from "@features/feeds/components/feed-favicon";
import { updateNoteProject } from "@features/notes/api";
import { SpacePic } from "@features/spaces/components/space-pic";
import {
  inboxItemsQueryOptions,
  updateVaultItemProject,
} from "@features/vault/api";
import {
  usePworItemDrop,
  type PworItemDrag,
} from "@features/vault/lib/drag";
import {
  deleteWorkspace,
  workspacesQueryOptions,
  type Workspace,
} from "@features/workspaces/api";
import { CreateWorkspaceDialog } from "@features/workspaces/components/create-workspace-dialog";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";

const sectionLabelClass = "pl-2 pr-6 text-sm font-normal";
const childItemClass = "h-7 text-xs font-normal";
const addActionClass =
  "top-4 right-2 size-4 after:hidden text-muted-foreground hover:text-foreground [&>svg]:size-3";

async function movePworItems(item: PworItemDrag, workspaceId: string | null) {
  for (const id of item.ids) {
    switch (item.kind) {
      case "vault":
        await updateVaultItemProject(id, workspaceId);
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
  const { data: inboxList } = useQuery(inboxItemsQueryOptions());
  const inboxCount = inboxList?.items.length ?? 0;
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

  function selectSpace(id: string) {
    setStoredWorkspaceId(id);
    void navigate({ to: "/$workspaceId", params: { workspaceId: id } });
  }

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

      <SidebarGroup className="relative">
        <SidebarGroupLabel className={sectionLabelClass}>
          Spaces
        </SidebarGroupLabel>
        <SidebarGroupAction
          aria-label="New space"
          className={addActionClass}
          onClick={() => setCreateSpaceOpen(true)}
        >
          <PlusIcon />
        </SidebarGroupAction>

        <SidebarGroupContent className="max-h-72 overflow-y-auto scrollbar-thin">
          <SidebarMenu className="gap-0.5">
            {spaces.map((space) => (
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
        <SidebarGroupLabel
          className={sectionLabelClass}
          render={<Link to="/feeds" search={{ item: undefined }} />}
        >
          Feeds
          {feedsUnread > 0 ? (
            <span className="ml-auto font-nums text-xs text-muted-foreground">
              {feedsUnread}
            </span>
          ) : null}
        </SidebarGroupLabel>
        <SidebarGroupAction
          aria-label="Add feed"
          className={addActionClass}
          onClick={() => setAddFeedOpen(true)}
        >
          <PlusIcon />
        </SidebarGroupAction>

        <SidebarGroupContent className="max-h-72 overflow-y-auto scrollbar-thin">
          <SidebarMenu className="gap-0.5">
            {feeds.map((feed) => (
              <SidebarMenuItem key={feed.id}>
                <SidebarMenuButton
                  isActive={activeFeedId === feed.id}
                  size="sm"
                  render={
                    <Link
                      to="/feeds/$feedId"
                      params={{ feedId: feed.id }}
                      search={{ item: undefined }}
                    />
                  }
                  className={childItemClass}
                >
                  <FeedFavicon siteUrl={feed.siteUrl} />
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
        queryClient.invalidateQueries({ queryKey: ["vault", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      movedToast(item, "Inbox");
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const { isOver, dropProps } = usePworItemDrop({
    canDrop: (item) => item.kind === "vault" && item.fromWorkspaceId !== null,
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
  onSelect,
}: {
  space: Workspace;
  isActive: boolean;
  onSelect: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const label = space.name.trim() || "Untitled";

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkspace(space.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryOptions.queryKey,
        exact: true,
      });
      if (isActive) {
        void navigate({ to: "/inbox" });
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: (item: PworItemDrag) => movePworItems(item, space.id),
    onSuccess: async (_result, item) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vault", "items"] }),
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
    <AlertDialog>
      <SidebarMenuItem
        {...dropProps}
        className={cn("rounded-md", isOver && "bg-sidebar-accent")}
      >
        <SidebarMenuButton
          isActive={isActive}
          size="sm"
          className={childItemClass}
          tooltip={label}
          onClick={onSelect}
        >
          <SpacePic shaderId={space.shader} className="size-3.5" />
          <span className="truncate">{label}</span>
        </SidebarMenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuAction
                showOnHover
                aria-label={`${label} actions`}
                className={cn(
                  "top-1/2 right-1 size-4 -translate-y-1/2 after:hidden text-muted-foreground peer-data-[size=sm]/menu-button:top-1/2 [&>svg]:size-3",
                  isOver && "opacity-0",
                )}
              />
            }
          >
            <DotsHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <AlertDialogTrigger
              render={
                <DropdownMenuItem
                  variant="destructive"
                  className="font-normal text-xs"
                />
              }
            >
              Delete
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the space and everything in it. This
            can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
