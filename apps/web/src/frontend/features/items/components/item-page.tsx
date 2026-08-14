import { CaretSortIcon, DotsHorizontalIcon } from "@radix-ui/react-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll";
import { PageEmpty } from "@components/page-empty";
import {
  deleteItem,
  itemsInfiniteQueryOptions,
  itemUsageQueryOptions,
  type Item,
} from "@features/items/api";
import { ItemHoverCard, ItemMention } from "@features/items/components/item-mention";
import { FacetSidebar } from "@features/items/components/item-facet-sidebar";
import { ItemRenameDialog } from "@features/items/components/item-rename-dialog";
import { ItemViewer } from "@features/items/components/item-viewer";
import {
  filterAndSortItems,
  formatItemDate,
  ITEM_SORT_LABEL,
  ITEM_SORT_ORDER,
  type ItemNav,
  type ItemSort,
} from "@features/items/lib/list";

function ItemRow({
  item,
  onOpen,
}: {
  item: Item;
  onOpen: (item: Item) => void;
}) {
  const queryClient = useQueryClient();
  const [renameOpen, setRenameOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteItem(item.id),
    onSuccess: () => {
      toast.success(`Deleted ${item.title ?? "item"}`);
      queryClient.invalidateQueries({
        queryKey: ["item", "items"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const tags = item.tags?.slice(0, 4) ?? [];

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <ItemHoverCard item={item}>
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
          onClick={() => onOpen(item)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ItemMention item={item} className="min-w-0 flex-1" />
            {item.parseStatus === "pending" ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                parsing
              </span>
            ) : null}
          </span>
          {item.summary || tags.length > 0 ? (
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {item.summary ? (
                <span className="line-clamp-1 min-w-0 flex-1">
                  {item.summary}
                </span>
              ) : null}
              {tags.map((tag) => (
                <span key={tag} className="shrink-0">
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
        </button>
      </ItemHoverCard>

      <div className="flex shrink-0 items-center gap-3">
        <span className="font-nums text-xs text-muted-foreground">
          {formatItemDate(item.createdAt)}
        </span>

        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <DotsHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="font-normal text-xs"
                onClick={() => onOpen(item)}
              >
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                className="font-normal text-xs"
                onClick={() => setRenameOpen(true)}
              >
                Rename
              </DropdownMenuItem>
              {item.url ? (
                <DropdownMenuItem
                  className="font-normal text-xs"
                  render={
                    <a href={item.url} target="_blank" rel="noreferrer" />
                  }
                >
                  Open link
                </DropdownMenuItem>
              ) : null}
              {item.kind === "file" ? (
                <DropdownMenuItem
                  className="font-normal text-xs"
                  render={<a href={`/api/items/${item.id}/file`} download />}
                >
                  Download
                </DropdownMenuItem>
              ) : null}
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
                Delete
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {item.title ?? "item"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the item. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ItemRenameDialog
          item={item}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
      </div>
    </li>
  );
}

export function ItemPage() {
  const isMobile = useIsMobile();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const search = useSearch({ from: "/_app/$workspaceId/items/" });
  const navigate = useNavigate({ from: "/$workspaceId/items/" });
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(itemsInfiniteQueryOptions(workspaceId));
  const { data: usage } = useQuery(itemUsageQueryOptions(workspaceId));
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const totalBytes = usage?.totalBytes ?? 0;
  const sentinelRef = useInfiniteScrollSentinel(() => {
    if (!isFetchingNextPage) void fetchNextPage();
  }, hasNextPage);
  const [nav, setNav] = useState<ItemNav>({ mode: "all" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ItemSort>("newest");
  const openItemId = search.item;

  const filtered = filterAndSortItems(items, { nav, query, sort });
  const openItem =
    openItemId != null
      ? (items.find((item) => item.id === openItemId) ?? null)
      : null;

  function setViewerOpen(open: boolean, itemId?: string) {
    void navigate({
      search: open && itemId ? { item: itemId } : {},
      replace: true,
    });
  }

  function handleNavChange(next: ItemNav) {
    setNav(next);
  }

  const emptyTitle = (() => {
    if (query.trim()) return "No matches";
    switch (nav.mode) {
      case "all":
        return "Nothing in the item yet";
      case "type":
        return `Nothing in ${nav.type} yet`;
      default: {
        const _exhaustive: never = nav;
        return _exhaustive;
      }
    }
  })();

  const toolbar = (
    <div className="flex h-12 shrink-0 items-center gap-2 px-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="h-7 max-w-xs border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
      />
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                className="gap-1 font-normal text-muted-foreground"
              />
            }
          >
            {ITEM_SORT_LABEL[sort]}
            <CaretSortIcon className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-28">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => {
                if (
                  value === "newest" ||
                  value === "oldest" ||
                  value === "name"
                ) {
                  setSort(value);
                }
              }}
            >
              {ITEM_SORT_ORDER.map((option) => (
                <DropdownMenuRadioItem
                  key={option}
                  value={option}
                  className="font-normal text-xs"
                >
                  {ITEM_SORT_LABEL[option]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const list = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-20">
      {filtered.length === 0 ? (
        <PageEmpty
          title={emptyTitle}
          description={
            query.trim()
              ? "Try a different search."
              : "Paste a link or text — or upload a file."
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-dashed divide-border">
          {filtered.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onOpen={(next) => setViewerOpen(true, next.id)}
            />
          ))}
        </ul>
      )}
      {hasNextPage ? <div ref={sentinelRef} className="h-8" /> : null}
    </div>
  );

  const content = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {toolbar}
      {list}
      {openItem ? (
        <ItemViewer
          item={openItem}
          open
          onOpenChange={(open) => setViewerOpen(open, openItem.id)}
        />
      ) : null}
    </div>
  );

  const sidebar = (
    <FacetSidebar
      items={items}
      totalBytes={totalBytes}
      nav={nav}
      onNavChange={handleNavChange}
    />
  );

  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {sidebar}
        {content}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 overflow-hidden"
    >
      <ResizablePanel
        id="item-aside"
        defaultSize={200}
        minSize={160}
        maxSize={360}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {sidebar}
      </ResizablePanel>

      <ResizableHandle className="w-px bg-border/40 after:w-px" />

      <ResizablePanel
        id="item-content"
        defaultSize="80%"
        minSize="50%"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {content}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
