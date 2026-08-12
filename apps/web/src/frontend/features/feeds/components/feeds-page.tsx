import { PlusIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import {
  createFeed,
  deleteFeed,
  feedItemQueryOptions,
  feedItemsQueryOptions,
  feedsQueryOptions,
  markFeedItemRead,
  syncAllFeeds,
  syncFeed,
  type FeedItem,
} from "@features/feeds/api";
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
        "flex w-full flex-col gap-0.5 border-b border-dashed border-border/40 px-3 py-3 text-left hover:bg-muted/40",
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

function AddFeedDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) setUrl("");
  }, [open]);

  const create = useMutation({
    mutationFn: () => createFeed(url.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Feed added");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn’t add feed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!url.trim() || create.isPending) return;
            create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add feed</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Paste a site, RSS/Atom URL, or YouTube channel.
          </p>
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className="h-8 text-xs"
            disabled={create.isPending}
          />
          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || create.isPending}>
              {create.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const listItem = useMemo(
    () => (itemId ? (items.find((item) => item.id === itemId) ?? null) : null),
    [itemId, items],
  );
  const { data: detailItem } = useQuery({
    ...feedItemQueryOptions(itemId ?? ""),
    enabled: Boolean(itemId),
  });

  const activeFeed = feedId
    ? (feeds.find((feed) => feed.id === feedId) ?? null)
    : null;

  const openItem: FeedItem | null = detailItem ?? listItem;

  useEffect(() => {
    if (!openItem || openItem.readAt) return;
    const id = openItem.id;
    void markFeedItemRead(id)
      .then((updated) => {
        queryClient.setQueryData(feedItemQueryOptions(id).queryKey, updated);
        void queryClient.invalidateQueries({ queryKey: ["feeds"] });
      })
      .catch(() => {
        // ignore — open still works
      });
  }, [openItem?.id, openItem?.readAt, queryClient]);

  useEffect(() => {
    if (!detailItem) return;
    queryClient.setQueryData(
      feedItemsQueryOptions({ feedId }).queryKey,
      (current: FeedItem[] | undefined) =>
        current?.map((row) =>
          row.id === detailItem.id ? { ...row, ...detailItem } : row,
        ),
    );
  }, [detailItem, feedId, queryClient]);

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/40">
        <div className="flex h-12 items-center gap-2 px-3">
          <h1 className="min-w-0 flex-1 truncate text-sm font-normal">
            {feedId ? title : "Feeds"}
          </h1>
          {feedId ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="font-normal text-muted-foreground"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(feedId)}
            >
              Remove
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
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "min-h-0 w-full overflow-y-auto border-r border-border/40 md:w-80 md:shrink-0",
            openItem && "hidden md:block",
          )}
        >
          {items.length === 0 ? (
            <PageEmpty
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

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            !openItem && "hidden md:block",
          )}
        >
          {openItem ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-10 shrink-0 items-center border-b border-border/40 px-3 md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="font-normal"
                  onClick={() => setItem(undefined)}
                >
                  Back
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ArticleReader item={openItem} />
              </div>
            </div>
          ) : (
            <div className="hidden h-full items-center justify-center md:flex">
              <p className="text-xs text-muted-foreground">
                Select an item to read
              </p>
            </div>
          )}
        </div>
      </div>

      <AddFeedDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
