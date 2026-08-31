import { CaretDownIcon, TrashIcon } from "@radix-ui/react-icons";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useInfiniteQuery,
  useMutation,
  useMutationState,
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
import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import { SplitPreviewLayout } from "@components/split-preview-layout";
import {
  deleteItems,
  itemsDeleteKey,
  itemsInfiniteQueryOptions,
  itemsMoveKey,
  itemsPinKey,
  updateItemPinned,
  updateItems,
  type Item,
} from "@features/items/api";
import { ItemPreview } from "@features/items/components/item-preview";
import { LibraryHeader, ContentColumn } from "@features/items/components/library-header";
import { LibraryInbox } from "@features/items/components/library-inbox";
import { LibrarySelectionBar } from "@features/items/components/library-selection-bar";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { LibraryView } from "@features/items/components/library-view";
import { LibraryViewToggle } from "@features/items/components/library-view-toggle";
import { useLibraryView } from "@features/items/lib/view";
import {
  TYPE_FACET_LABEL,
  TYPE_FACET_ORDER,
  type ItemTypeFacet,
} from "@features/items/lib/facet";
import { filterAndSortItems, type ItemSort } from "@features/items/lib/list";
import { deleteSpace, spacesQueryOptions } from "@features/spaces/api";

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
  const [view, setView] = useLibraryView();

  const { data: spaces = [] } = useQuery(spacesQueryOptions);
  const space = spaceId
    ? spaces.find((item) => item.id === spaceId)
    : undefined;
  const title = inbox ? "Inbox" : space?.name.trim() || "Untitled";

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
    mutationKey: itemsDeleteKey,
    mutationFn: (ids: string[]) => deleteItems(ids),
    onMutate: (ids) => {
      setSelected((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (openId && ids.includes(openId)) setOpenItem(null);
    },
    onError: () => toast.error("Couldn’t delete"),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
  });

  const moveMutation = useMutation({
    mutationKey: itemsMoveKey,
    mutationFn: (vars: { ids: string[]; spaceId: string }) =>
      updateItems(vars.ids, { spaceId: vars.spaceId }),
    onMutate: (vars) => {
      setSelected((current) => {
        const next = new Set(current);
        for (const id of vars.ids) next.delete(id);
        return next;
      });
      if (openId && vars.ids.includes(openId)) setOpenItem(null);
    },
    onSuccess: (_result, vars) => {
      const destination =
        spaces.find((item) => item.id === vars.spaceId)?.name.trim() ||
        "Untitled";
      toast.success(
        vars.ids.length > 1
          ? `Moved ${vars.ids.length} to ${destination}`
          : `Moved to ${destination}`,
      );
    },
    onError: () => toast.error("Couldn’t move item"),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["spaces"] }),
      ]),
  });

  const pinMutation = useMutation({
    mutationKey: itemsPinKey,
    mutationFn: (entry: { id: string; pinned: boolean }) =>
      updateItemPinned(entry.id, entry.pinned),
    onError: () => toast.error("Couldn’t pin"),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
  });

  const deleting = useMutationState({
    filters: { mutationKey: itemsDeleteKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string[] | undefined,
  });
  const moving = useMutationState({
    filters: { mutationKey: itemsMoveKey, status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as { ids: string[] } | undefined)?.ids,
  });
  const pinning = useMutationState({
    filters: { mutationKey: itemsPinKey, status: "pending" },
    select: (mutation) =>
      mutation.state.variables as { id: string; pinned: boolean } | undefined,
  });

  const sorted = useMemo(() => {
    const hidden = new Set<string>();
    for (const ids of deleting) {
      for (const id of ids ?? []) hidden.add(id);
    }
    for (const ids of moving) {
      for (const id of ids ?? []) hidden.add(id);
    }
    const pinById = new Map<string, boolean>();
    for (const entry of pinning) {
      if (entry) pinById.set(entry.id, entry.pinned);
    }
    const next = items
      .filter((item) => !hidden.has(item.id))
      .map((item) => {
        const pinned = pinById.get(item.id);
        return pinned === undefined ? item : { ...item, pinned };
      });
    return filterAndSortItems(next, {
      facets: filters,
      query,
      sort,
    });
  }, [items, filters, query, sort, deleting, moving, pinning]);
  const entries = useMemo(
    () => sorted.map((item) => ({ kind: "item" as const, item })),
    [sorted],
  );
  const hasCaptured = items.length > 0;
  const hiding = deleting.length > 0 || moving.length > 0;

  const selectedIds = sorted
    .map((item) => item.id)
    .filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;

  const openHidden =
    openId != null &&
    (deleting.some((ids) => ids?.includes(openId)) ||
      moving.some((ids) => ids?.includes(openId)));
  const openItem =
    openId != null && !openHidden
      ? (items.find((item) => item.id === openId) ?? null)
      : null;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0 && openItem == null,
    conflictBehavior: "replace",
  });
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

  const listBody = !hasCaptured ? (
    <div className="px-4 pb-24">
      <PageEmpty
        className={inbox ? "min-h-[32vh] py-10" : undefined}
        title={inbox ? "Nothing yet" : "Nothing here yet"}
        description={
          <span className="flex items-center justify-center gap-1">
            <Kbd>⌘U</Kbd>
            {inbox ? "to capture. Paste a link anywhere." : "to capture."}
          </span>
        }
      />
    </div>
  ) : entries.length === 0 && !hiding ? (
    <div className="px-4 pb-24">
      <PageEmpty
        title="No matches"
        description="Try a different search or filter."
      />
    </div>
  ) : (
    <LibraryView
      view={view}
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
        if (entry.kind === "item") {
          pinMutation.mutate({
            id: entry.item.id,
            pinned: !entry.item.pinned,
          });
        }
      }}
      onDelete={(ids) => deleteMutation.mutate(ids)}
      onDraggingIds={(ids) => setDraggingIds(new Set(ids))}
    />
  );

  const facetMenu = (
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
  );

  const viewSort = (
    <div className="flex items-center gap-2">
      <LibraryViewToggle value={view} onChange={setView} />
      <LibrarySortMenu value={sort} onChange={setSort} />
    </div>
  );

  const listPane = (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
      <LibraryHeader
        edgeToEdge={previewOpen}
        leading={
          <h1 className="min-w-0 truncate text-base leading-none font-normal tracking-tight">
            {title}
          </h1>
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
          inbox || !hasCaptured ? null : (
            <>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search…"
                className="h-7 min-w-0 max-w-[12rem] text-xs sm:max-w-xs"
              />
              {facetMenu}
              {viewSort}
            </>
          )
        }
      />
      <ContentColumn
        constrain={!previewOpen}
        className={inbox ? "pt-6 md:pt-6" : undefined}
      >
        {inbox ? (
          <LibraryInbox edgeToEdge={previewOpen}>
            {hasCaptured ? (
              <div
                className={cn(
                  "flex items-center gap-2 pb-3",
                  previewOpen ? "px-3" : "px-4",
                )}
              >
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search…"
                  className="h-7 min-w-0 max-w-[12rem] text-xs sm:max-w-xs"
                />
                {facetMenu}
                <div className="ml-auto">{viewSort}</div>
              </div>
            ) : null}
            {listBody}
          </LibraryInbox>
        ) : (
          listBody
        )}
      </ContentColumn>
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
        busy={false}
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
        onMove={(nextSpaceId) =>
          moveMutation.mutate({ ids: selectedIds, spaceId: nextSpaceId })
        }
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

