import {
  DotsHorizontalIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import {
  deleteFeed,
  feedItemsQueryOptions,
  feedsQueryOptions,
  markFeedItemRead,
  syncAllFeeds,
  syncFeed,
  type FeedItem,
} from "@features/feeds/api";
import { AddFeedDialog } from "@features/feeds/components/add-feed-dialog";
import { ArticleReader } from "@features/feeds/components/article-reader";

export const feedsSearchSchema = z.object({
  item: z.string().optional(),
});

function formatListDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function FeedItemRow({
  item,
  active,
  onOpen,
}: {
  item: FeedItem;
  active: boolean;
  onOpen: () => void;
}) {
  const unread = !item.readAt;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col gap-0.5 border-b border-dashed border-border/40 px-4 py-3 text-left hover:bg-muted/40",
        active && "bg-muted/50",
      )}
    >
      <span
        className={cn(
          "line-clamp-2 text-sm",
          unread ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {item.title?.trim() || "Untitled"}
      </span>
      <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {item.feedTitle?.trim() ||
            (item.feedKind === "youtube" ? "YouTube" : "Feed")}
        </span>
        <span className="shrink-0 font-nums">
          {formatListDate(item.publishedAt)}
        </span>
      </span>
    </button>
  );
}

export function FeedsPage({
  feedId,
  itemId,
}: {
  feedId?: string;
  itemId?: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const { data: feeds = [] } = useQuery(feedsQueryOptions());
  const { data: items = [] } = useQuery(feedItemsQueryOptions({ feedId }));

  const activeFeed = feedId
    ? (feeds.find((feed) => feed.id === feedId) ?? null)
    : null;

  const openItem = useMemo(
    () => (itemId ? (items.find((item) => item.id === itemId) ?? null) : null),
    [itemId, items],
  );

  useEffect(() => {
    if (!openItem || openItem.readAt) return;
    const id = openItem.id;
    void markFeedItemRead(id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["feeds"] }))
      .catch(() => {
        // ignore — open still works
      });
  }, [openItem?.id, openItem?.readAt, queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (feedId) await syncFeed(feedId);
      else await syncAllFeeds();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Synced");
    },
    onError: () => toast.error("Sync failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFeed(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Feed removed");
      void navigate({ to: "/feeds" });
    },
    onError: () => toast.error("Couldn’t remove feed"),
  });

  function setItem(next: string | undefined) {
    if (feedId) {
      void navigate({
        to: "/feeds/$feedId",
        params: { feedId },
        search: { item: next },
        replace: true,
      });
      return;
    }
    void navigate({
      to: "/feeds",
      search: { item: next },
      replace: true,
    });
  }

  const title = activeFeed?.title?.trim() || activeFeed?.siteName || "Feeds";
  const paneEmptyClass = "min-h-0 py-0";

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          "flex min-h-0 w-full flex-col border-r border-border/40 md:w-80 md:shrink-0",
          openItem && "hidden md:flex",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 px-4">
          <h1 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
            {feedId ? title : "Feeds"}
          </h1>
          {feedId ? (
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Actions"
                      disabled={deleteMutation.isPending}
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
                    Remove
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the feed and its saved items. This can’t be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(feedId)}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin"
        >
          {items.length === 0 ? (
            <PageEmpty
              className={paneEmptyClass}
              title={feeds.length === 0 ? "No feeds yet" : "Nothing here"}
              description={
                feeds.length === 0
                  ? "Add a site, RSS feed, or YouTube channel."
                  : "Sync or wait for new posts."
              }
              action={
                feeds.length === 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="font-normal"
                    onClick={() => setAddOpen(true)}
                  >
                    Add feed
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col">
              {items.map((item) => (
                <FeedItemRow
                  key={item.id}
                  item={item}
                  active={item.id === itemId}
                  onOpen={() => setItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          !openItem && "hidden md:flex",
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-end gap-2 px-4">
          {openItem ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="mr-auto font-normal md:hidden"
              onClick={() => setItem(undefined)}
            >
              Back
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Sync"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            <ReloadIcon
              className={cn(syncMutation.isPending && "animate-spin")}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Add feed"
            onClick={() => setAddOpen(true)}
          >
            <PlusIcon />
          </Button>
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin"
        >
          {openItem ? (
            <ArticleReader item={openItem} />
          ) : (
            <PageEmpty
              className={paneEmptyClass}
              title=""
              description="Select an item to read"
            />
          )}
        </div>
      </div>

      <AddFeedDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
