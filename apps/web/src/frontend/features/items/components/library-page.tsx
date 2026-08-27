import { CaretDownIcon, TrashIcon } from "@radix-ui/react-icons";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll";
import { PageEmpty } from "@components/page-empty";
import { SplitPreviewLayout } from "@components/split-preview-layout";
import { userInboxQueryOptions } from "@features/inbox/api";
import {
  deleteItems,
  itemsInfiniteQueryOptions,
  updateItemPinned,
  updateItems,
  type Item,
} from "@features/items/api";
import { ItemPreview } from "@features/items/components/item-preview";
import { LibraryHeader } from "@features/items/components/library-header";
import {
  LibraryList,
  itemEntries,
} from "@features/items/components/library-list";
import { LibrarySelectionBar } from "@features/items/components/library-selection-bar";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import {
  TYPE_FACET_LABEL,
  TYPE_FACET_ORDER,
  type ItemTypeFacet,
} from "@features/items/lib/facet";
import { filterAndSortItems, type ItemSort } from "@features/items/lib/list";
import { deleteSpace, spacesQueryOptions } from "@features/spaces/api";

export const librarySearchSchema = z.object({
  item: z.string().optional(),
});

export function LibraryPage() {
  const params = useParams({ strict: false });
  const spaceId = "spaceId" in params ? params.spaceId : undefined;
  const inbox = spaceId == null;
  const search = useSearch({ strict: false });
  const openId = "item" in search ? search.item : undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<ItemTypeFacet>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<ItemSort>("newest");

  const { data: spaces = [] } = useQuery(spacesQueryOptions);
  const space = spaceId
    ? spaces.find((item) => item.id === spaceId)
    : undefined;
  const title = inbox ? "Inbox" : space?.name.trim() || "Untitled";

  const inboxAddress = useQuery({
    ...userInboxQueryOptions(),
    enabled: inbox,
  });
  const address = inboxAddress.data?.address;

  const listQuery = useInfiniteQuery(
    itemsInfiniteQueryOptions(
      spaceId ? { spaceId } : { inbox: true },
    ),
  );
  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );
  const sentinelRef = useInfiniteScrollSentinel(() => {
    if (!listQuery.isFetchingNextPage) void listQuery.fetchNextPage();
  }, listQuery.hasNextPage);

  const sorted = useMemo(
    () =>
      filterAndSortItems(items, {
        facets: inbox ? undefined : filters,
        query: inbox ? undefined : query,
        sort,
      }),
    [items, filters, query, sort, inbox],
  );
  const entries = useMemo(() => itemEntries(sorted), [sorted]);
  const hasCaptured = items.length > 0;

  const selectedIds = sorted
    .map((item) => item.id)
    .filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;

  const openItem =
    openId != null ? (items.find((item) => item.id === openId) ?? null) : null;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0 && openItem == null,
    conflictBehavior: "replace",
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: () => deleteSpace(spaceId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: spacesQueryOptions.queryKey,
        exact: true,
      });
      void navigate({ to: "/inbox" });
    },
    onError: () => toast.error("Couldn’t delete space"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteItems(ids),
    onSuccess: async (_result, ids) => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      if (openId && ids.includes(openId)) setOpenItem(null);
    },
    onError: () => toast.error("Couldn’t delete"),
  });

  const moveMutation = useMutation({
    mutationFn: (nextSpaceId: string) =>
      updateItems(selectedIds, { spaceId: nextSpaceId }),
    onSuccess: async (_result, nextSpaceId) => {
      const count = selectedIds.length;
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["spaces"] }),
      ]);
      if (openId && selectedIds.includes(openId)) setOpenItem(null);
      const destination =
        spaces.find((item) => item.id === nextSpaceId)?.name.trim() ||
        "Untitled";
      toast.success(
        count > 1
          ? `Moved ${count} to ${destination}`
          : `Moved to ${destination}`,
      );
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const pinMutation = useMutation({
    mutationFn: (item: Item) => updateItemPinned(item.id, !item.pinned),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
    },
    onError: () => toast.error("Couldn’t pin"),
  });

  const busy = deleteMutation.isPending || moveMutation.isPending;
  const filterLabel =
    filters.size === 0
      ? "All"
      : TYPE_FACET_ORDER.filter((id) => filters.has(id))
          .map((id) => TYPE_FACET_LABEL[id])
          .join(", ");

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleFilter(id: ItemTypeFacet) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setOpenItem(item: Item | null) {
    const id = item?.id;
    if (spaceId) {
      void navigate({
        to: "/spaces/$spaceId",
        params: { spaceId },
        search: { item: id },
        replace: true,
      });
      return;
    }
    void navigate({
      to: "/inbox",
      search: { item: id },
      replace: true,
    });
  }

  const previewOpen = openItem != null;
  const scope = inbox ? "Inbox" : "this space";

  const listPane = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <LibraryHeader
        edgeToEdge={previewOpen}
        leading={
          <>
            <h1 className="min-w-0 truncate text-base leading-none font-normal">
              {title}
            </h1>
            {inbox && address ? (
              <InboxForwardAddress address={address} />
            ) : null}
          </>
        }
        trailing={
          inbox ? null : (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete space"
                          className="text-muted-foreground hover:text-destructive active:text-destructive"
                        />
                      }
                    />
                  }
                >
                  <TrashIcon />
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the space and everything in it.
                    This can’t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => deleteSpaceMutation.mutate()}
                    disabled={deleteSpaceMutation.isPending}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
        toolbar={
          hasCaptured ? (
            <>
              {inbox ? null : (
                <>
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search…"
                    className="h-7 min-w-0 max-w-[12rem] text-xs sm:max-w-xs"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="max-w-[8rem] shrink-0 font-normal text-muted-foreground"
                        />
                      }
                    >
                      <span className="truncate">{filterLabel}</span>
                      <CaretDownIcon data-icon="inline-end" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-32">
                      {TYPE_FACET_ORDER.map((id) => (
                        <DropdownMenuCheckboxItem
                          key={id}
                          className="font-normal text-xs"
                          checked={filters.has(id)}
                          onCheckedChange={() => toggleFilter(id)}
                        >
                          {TYPE_FACET_LABEL[id]}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              <LibrarySortMenu value={sort} onChange={setSort} />
            </>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasCaptured ? (
          <div className="px-4 pt-6 pb-24">
            <PageEmpty
              title={inbox ? "Nothing yet" : "Nothing here yet"}
              description={
                <span className="flex items-center justify-center gap-1">
                  <Kbd>⌘U</Kbd>
                  {inbox ? "to capture. Paste a link anywhere." : "to capture."}
                </span>
              }
            />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 pt-6 pb-24">
            <PageEmpty
              title="No matches"
              description="Try a different search or filter."
            />
          </div>
        ) : (
          <LibraryList
            entries={entries}
            edgeToEdge={previewOpen}
            selected={selected}
            draggingIds={draggingIds}
            deleteDescription={`This permanently removes it from ${scope}. This can’t be undone.`}
            fromSpaceId={spaceId ?? null}
            hasNextPage={Boolean(listQuery.hasNextPage)}
            sentinelRef={sentinelRef}
            onOpen={(entry) => {
              if (entry.kind === "item") setOpenItem(entry.item);
            }}
            onToggle={toggleSelected}
            onPin={(entry) => {
              if (entry.kind === "item") pinMutation.mutate(entry.item);
            }}
            onDelete={(ids) => deleteMutation.mutate(ids)}
            onDraggingIds={(ids) => setDraggingIds(new Set(ids))}
          />
        )}
      </div>
    </div>
  );

  const previewPane = openItem ? (
    <ItemPreview
      key={openItem.id}
      item={openItem}
      onClose={() => setOpenItem(null)}
    />
  ) : null;

  const selectionBar =
    selectedCount > 0 ? (
      <LibrarySelectionBar
        count={selectedCount}
        busy={busy}
        excludeSpaceId={spaceId}
        deleteTitle={
          selectedCount === 1
            ? inbox
              ? "Delete capture?"
              : "Delete item?"
            : `Delete ${selectedCount} ${inbox ? "captures" : "items"}?`
        }
        deleteDescription={`This permanently removes ${selectedCount === 1 ? "it" : "them"} from ${scope}. This can’t be undone.`}
        onClear={() => setSelected(new Set())}
        onMove={(nextSpaceId) => moveMutation.mutate(nextSpaceId)}
        onDelete={() => deleteMutation.mutate(selectedIds)}
      />
    ) : null;

  return (
    <SplitPreviewLayout
      list={listPane}
      preview={previewPane}
      previewOpen={previewOpen}
      overlay={selectionBar}
      listId={inbox ? "inbox-list" : "library-list"}
      previewId={inbox ? "inbox-preview" : "library-preview"}
    />
  );
}

function InboxForwardAddress({ address }: { address: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="min-w-0 truncate text-left text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(address);
              toast.success("Copied");
            }}
          />
        }
      >
        {address}
      </TooltipTrigger>
      <TooltipContent>Forward email here to add it to Inbox</TooltipContent>
    </Tooltip>
  );
}
