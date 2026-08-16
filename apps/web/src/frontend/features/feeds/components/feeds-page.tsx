import {
  ArrowLeftIcon,
  DotsHorizontalIcon,
  OpenInNewWindowIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { format, isValid } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SidebarTrigger } from "@/components/ui/sidebar";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TooltipIconButton } from "@/components/ui/tooltip";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import { SplitPreviewLayout } from "@components/split-preview-layout";
import { HoverPreview, Mention } from "@features/items/components/item-mention";
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
import { FeedFavicon } from "@features/feeds/components/feed-favicon";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { sortBy, type ItemSort } from "@features/items/lib/list";

export const feedsSearchSchema = z.object({
  item: z.string().optional(),
});

function formatListDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!isValid(date)) return "";
  return format(date, "MMM d");
}

function FeedItemRow({
  item,
  active,
  showSource,
  onOpen,
}: {
  item: FeedItem;
  active: boolean;
  showSource: boolean;
  onOpen: () => void;
}) {
  const unread = !item.readAt;
  const title = item.title?.trim() || "Untitled";
  const subtitle = item.summary?.trim() || null;
  const label =
    item.feedTitle?.trim() ||
    (item.feedKind === "youtube" ? "YouTube" : "Feed");

  function openExternal(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    if (item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      onClick={onOpen}
      className={cn(
        "cursor-pointer border-b border-dashed border-border/40 px-4 py-3 text-left select-none hover:bg-muted/40 active:bg-muted/40",
        active && "bg-muted/50",
      )}
    >
      <div className="flex items-start gap-3">
        {showSource ? (
          <FeedFavicon
            siteUrl={item.feedSiteUrl ?? item.url}
            imageUrl={item.feedImageUrl}
            className="mt-0.5 size-4"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <HoverPreview
              content={
                item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="aspect-video w-full object-cover"
                  />
                ) : null
              }
            >
              <Mention
                title={title}
                label={showSource ? label : null}
                className="min-w-0 flex-1"
                titleClassName={cn(
                  "no-underline",
                  unread ? undefined : "text-muted-foreground",
                )}
              />
            </HoverPreview>
            <span className="flex shrink-0 items-center gap-1">
              <span
                className="flex size-4 items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <TooltipIconButton
                  label="Open in new window"
                  className="size-4 text-muted-foreground [&_svg]:size-3"
                  disabled={!item.url}
                  onClick={openExternal}
                >
                  <OpenInNewWindowIcon />
                </TooltipIconButton>
              </span>
              <span className="w-12 shrink-0 text-right font-nums text-xs leading-none text-muted-foreground">
                {formatListDate(item.publishedAt)}
              </span>
            </span>
          </div>
          {subtitle ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function FeedsPage() {
  const { feedId } = useParams({ strict: false });
  const { item: itemId } = useSearch({ strict: false });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ItemSort>("newest");
  const q = useDebouncedValue(query.trim(), 250);
  const { data: feeds = [] } = useQuery(feedsQueryOptions());
  const { data: items = [] } = useQuery(
    feedItemsQueryOptions({ feedId, q: q || undefined }),
  );
  const sorted = useMemo(
    () =>
      sortBy(items, sort, {
        date: (item) => item.publishedAt ?? item.createdAt,
        name: (item) => item.title ?? "",
      }),
    [items, sort],
  );

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
  const paneEmptyClass = "h-full min-h-0 flex-1 py-0";
  const previewOpen = openItem != null;

  const listPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="md:hidden" />
        <h1 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
          {feedId ? title : "Feeds"}
        </h1>
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
            <DropdownMenuContent align="end" className="shadow-none">
              <DropdownMenuItem
                className="font-normal text-xs"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                {syncMutation.isPending ? "Syncing…" : "Sync"}
              </DropdownMenuItem>
              {feedId ? (
                <>
                  <DropdownMenuSeparator />
                  <AlertDialogTrigger
                    nativeButton={false}
                    render={
                      <DropdownMenuItem
                        variant="destructive"
                        className="font-normal text-xs"
                      />
                    }
                  >
                    Remove
                  </AlertDialogTrigger>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {feedId ? (
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
          ) : null}
        </AlertDialog>
      </div>
      {feeds.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 px-4 pb-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="min-w-0 flex-1"
          />
          <LibrarySortMenu value={sort} onChange={setSort} />
        </div>
      ) : null}
      {items.length === 0 ? (
        <PageEmpty
          className={paneEmptyClass}
          title={
            q
              ? "No matches"
              : feeds.length === 0
                ? "No feeds yet"
                : "Nothing here"
          }
          description={
            q
              ? "Try a different search."
              : feeds.length === 0
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col">
            {sorted.map((item) => (
              <FeedItemRow
                key={item.id}
                item={item}
                active={item.id === itemId}
                showSource={!feedId}
                onOpen={() => setItem(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const readerPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center">
        <div className="mx-auto flex h-full w-full max-w-2xl items-center gap-2 px-4">
          <SidebarTrigger className="md:hidden" />
          {openItem ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="font-normal md:hidden"
              onClick={() => setItem(undefined)}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back
            </Button>
          ) : null}
          <h2 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
            {openItem ? openItem.title?.trim() || "Untitled" : null}
          </h2>
        </div>
      </div>
      {openItem ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ArticleReader item={openItem} />
        </div>
      ) : (
        <PageEmpty
          className={paneEmptyClass}
          description="Select an item to read"
        />
      )}
    </div>
  );

  const dialog = <AddFeedDialog open={addOpen} onOpenChange={setAddOpen} />;

  return (
    <SplitPreviewLayout
      list={listPane}
      preview={readerPane}
      previewOpen={previewOpen}
      persistPreview
      overlay={dialog}
      listId="feeds-list"
      previewId="feeds-reader"
      listSize="42%"
      previewSize="58%"
      listMinSize="28%"
      previewMinSize="36%"
      listClassName="border-r border-border/40"
    />
  );
}
