import {
  CaretDownIcon,
  Cross2Icon,
  EyeOpenIcon,
  OpenInNewWindowIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState, type DragEvent } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipIconButton,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import { SplitPreviewLayout } from "@components/split-preview-layout";
import { CaptureButton } from "@features/command/components/capture-button";
import { SpacePic } from "@features/spaces/components/space-pic";
import {
  deleteItem,
  updateItemProject,
  itemsInfiniteQueryOptions,
  type Item,
} from "@features/items/api";
import { ItemHoverCard, ItemMention } from "@features/items/components/item-mention";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { LibraryViewToggle } from "@features/items/components/library-view-toggle";
import {
  ITEM_CARD_GRID_CLASS,
  ItemCard,
} from "@features/items/components/item-card";
import { ItemPreview } from "@features/items/components/item-preview";
import { endPworItemDrag, setPworItemDrag } from "@features/items/lib/drag";
import { formatItemDate, kindLabel, sortBy, type ItemSort } from "@features/items/lib/list";
import { itemFileUrl, itemOpenHref } from "@features/items/lib/media";
import { useLibraryView } from "@features/items/lib/view";
import { workspacesQueryOptions } from "@features/workspaces/api";
import { toEpochMs } from "@shared/time";

type LibraryFacet = "links" | "files" | "text";

type LibraryRow = {
  key: string;
  title: string;
  typeLabel: string;
  facet: LibraryFacet;
  searchText: string;
  uploadedAt: number;
  kind: "item";
  tags: string[];
  pending: boolean;
  item?: Item;
};

const FACETS: { id: LibraryFacet; label: string }[] = [
  { id: "links", label: "Links" },
  { id: "files", label: "Files" },
  { id: "text", label: "Text" },
];

function formatListDate(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return formatItemDate(new Date(ms).toISOString());
}

function rowId(row: LibraryRow): string | undefined {
  return row.item?.id;
}

function LibraryListItem({
  row,
  selected,
  active,
  dragging,
  onOpen,
  onOpenExternal,
  onToggle,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  row: LibraryRow;
  selected: boolean;
  active: boolean;
  dragging: boolean;
  onOpen: () => void;
  onOpenExternal: () => void;
  onToggle: (checked: boolean) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  const didDrag = useRef(false);
  const downloadHref =
    row.kind === "item" && row.item && row.item.kind !== "link"
      ? itemFileUrl(row.item.id)
      : null;

  function handleOpen() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onOpen();
  }

  return (
    <ContextMenu>
      <AlertDialog>
        <ContextMenuTrigger
          render={
            <li
              draggable
              onDragStart={(event) => {
                if ((event.target as HTMLElement).closest("[data-no-drag]")) {
                  event.preventDefault();
                  return;
                }
                didDrag.current = true;
                onDragStart(event);
              }}
              onDragEnd={onDragEnd}
              className={cn(
                "group flex w-full cursor-grab items-center gap-2 px-4 py-2 select-none hover:bg-muted/40 active:cursor-grabbing",
                active && "bg-muted/50",
                row.pending && "animate-pulse",
                dragging && "opacity-40",
              )}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("[data-no-drag]")) {
                  return;
                }
                handleOpen();
              }}
            />
          }
        >
          <span
            data-no-drag
            className="flex size-4 shrink-0 items-center justify-center"
          >
            <Checkbox
              checked={selected}
              aria-label={`Select ${row.title}`}
              className="after:hidden"
              onCheckedChange={(checked) => onToggle(checked === true)}
            />
          </span>
          {row.item ? (
            <ItemHoverCard item={row.item}>
              <ItemMention item={row.item} className="min-w-0 flex-1" />
            </ItemHoverCard>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-normal">
              {row.title}
            </span>
          )}
          <span
            data-no-drag
            className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          >
            <TooltipIconButton
              label="Preview"
              className="text-muted-foreground"
              onClick={onOpen}
            >
              <EyeOpenIcon />
            </TooltipIconButton>
            <TooltipIconButton
              label="Open in new window"
              className="text-muted-foreground"
              onClick={onOpenExternal}
            >
              <OpenInNewWindowIcon />
            </TooltipIconButton>
            <Tooltip>
              <TooltipTrigger
                render={
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete"
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
          </span>
          <span className="shrink-0 text-xs font-nums text-muted-foreground">
            {formatListDate(row.uploadedAt)}
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent className="shadow-none">
          <ContextMenuGroup>
            <ContextMenuItem className="font-normal text-xs" onClick={onOpen}>
              Preview
            </ContextMenuItem>
            <ContextMenuItem
              className="font-normal text-xs"
              onClick={onOpenExternal}
            >
              Open in new window
            </ContextMenuItem>
            {downloadHref ? (
              <ContextMenuItem
                className="font-normal text-xs"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = downloadHref;
                  link.download = "";
                  link.click();
                }}
              >
                Download
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem
              className="font-normal text-xs"
              onClick={() => onToggle(true)}
            >
              Select
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <AlertDialogTrigger
              nativeButton={false}
              render={
                <ContextMenuItem
                  variant="destructive"
                  className="font-normal text-xs"
                />
              }
            >
              Delete
            </AlertDialogTrigger>
          </ContextMenuGroup>
        </ContextMenuContent>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {row.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes it from this space. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}

function LibrarySelectionBar({
  count,
  busy,
  currentWorkspaceId,
  onClear,
  onMove,
  onDelete,
}: {
  count: number;
  busy: boolean;
  currentWorkspaceId: string;
  onClear: () => void;
  onMove: (workspaceId: string) => void;
  onDelete: () => void;
}) {
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);
  const destinations = spaces.filter(
    (space) => space.id !== currentWorkspaceId,
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex justify-center px-4 pb-3">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-border bg-background px-1 py-0.5">
        <span className="px-1.5 font-nums text-xs text-muted-foreground">
          {count}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal"
                disabled={busy || destinations.length === 0}
              />
            }
          >
            Move
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            side="top"
            className="min-w-40 shadow-none"
          >
            {destinations.map((space) => (
              <DropdownMenuItem
                key={space.id}
                className="font-normal text-xs"
                onClick={() => onMove(space.id)}
              >
                <SpacePic shaderId={space.shader} className="size-3.5" />
                <span className="truncate">
                  {space.name.trim() || "Untitled"}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal text-muted-foreground hover:text-destructive active:text-destructive"
                disabled={busy}
              />
            }
          >
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {count === 1 ? "item" : `${count} items`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes {count === 1 ? "it" : "them"} from this
                space. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
              >
                {busy ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear selection"
          className="text-muted-foreground"
          onClick={onClear}
        >
          <Cross2Icon />
        </Button>
      </div>
    </div>
  );
}

export function SpaceLibraryPage() {
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const search = useSearch({ from: "/_app/$workspaceId/" });
  const navigate = useNavigate({ from: "/$workspaceId/" });
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<LibraryFacet>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [draggingKeys, setDraggingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [view, setView] = useLibraryView();
  const [sort, setSort] = useState<ItemSort>("newest");

  const { data: workspaces = [] } = useQuery(workspacesQueryOptions);
  const space = workspaces.find((item) => item.id === workspaceId);
  const spaceTitle = space?.name.trim() || "Untitled";

  const {
    data: itemList,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(itemsInfiniteQueryOptions(workspaceId));
  const items = useMemo(
    () => itemList?.pages.flatMap((page) => page.items) ?? [],
    [itemList],
  );
  const hasCaptured = items.length > 0;
  const sentinelRef = useInfiniteScrollSentinel(() => {
    if (!isFetchingNextPage) void fetchNextPage();
  }, hasNextPage);

  const filterLabel =
    filters.size === 0
      ? "All"
      : FACETS.filter((item) => filters.has(item.id))
          .map((item) => item.label)
          .join(", ");

  const data = useMemo(() => {
    const list: LibraryRow[] = [];

    for (const item of items) {
      const title = item.title?.trim() || "Untitled";
      const facet: LibraryFacet =
        item.kind === "link"
          ? "links"
          : item.kind === "text"
            ? "text"
            : "files";
      const searchText = [
        title,
        item.summary,
        ...(item.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      list.push({
        key: `item:${item.id}`,
        kind: "item",
        title,
        typeLabel: kindLabel(item),
        facet,
        searchText,
        uploadedAt: toEpochMs(item.createdAt),
        tags: item.tags ?? [],
        pending: item.parseStatus === "pending",
        item,
      });
    }

    return list;
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data.filter((row) => {
      if (filters.size > 0 && !filters.has(row.facet)) return false;
      if (!q) return true;
      return row.searchText.includes(q);
    });
    return sortBy(filtered, sort, {
      date: (row) => new Date(row.uploadedAt).toISOString(),
      name: (row) => row.title,
    });
  }, [data, filters, query, sort]);

  const selectedRows = rows.filter((row) => selected.has(row.key));
  const selectedCount = selectedRows.length;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (items: LibraryRow[]) => {
      for (const row of items) {
        if (row.item) await deleteItem(row.item.id);
      }
    },
    onSuccess: async (_result, items) => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      if (search.item && items.some((row) => row.item?.id === search.item)) {
        void navigate({ search: {}, replace: true });
      }
    },
    onError: () => toast.error("Couldn’t delete"),
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      items,
      workspaceId: nextWorkspaceId,
    }: {
      items: LibraryRow[];
      workspaceId: string;
    }) => {
      for (const row of items) {
        if (row.item)
          await updateItemProject(row.item.id, nextWorkspaceId);
      }
    },
    onSuccess: async (_result, { items, workspaceId: nextWorkspaceId }) => {
      const count = items.length;
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      if (search.item && items.some((row) => row.item?.id === search.item)) {
        void navigate({ search: {}, replace: true });
      }
      const destination =
        workspaces.find((space) => space.id === nextWorkspaceId)?.name.trim() ||
        "Untitled";
      toast.success(
        count > 1
          ? `Moved ${count} to ${destination}`
          : `Moved to ${destination}`,
      );
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const busy = deleteMutation.isPending || moveMutation.isPending;

  function toggleSelected(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function dragIdsFor(row: LibraryRow): string[] {
    const id = rowId(row);
    if (!id) return [];
    if (selected.has(row.key) && selectedCount > 1) {
      return selectedRows
        .filter((item) => item.kind === row.kind)
        .map(rowId)
        .filter((value): value is string => Boolean(value));
    }
    return [id];
  }

  function toggleFilter(id: LibraryFacet) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setOpenItem(item: Item | null) {
    void navigate({
      search: item ? { item: item.id } : {},
      replace: true,
    });
  }

  function openRow(row: LibraryRow) {
    if (row.item) setOpenItem(row.item);
  }

  function openRowExternal(row: LibraryRow) {
    if (!row.item) return;
    const href = itemOpenHref(row.item);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  const openItem =
    search.item != null
      ? (items.find((item) => item.id === search.item) ?? null)
      : null;

  const previewOpen = openItem != null;

  const listPane = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0">
        <div className="flex h-12 w-full items-center gap-2 px-4">
          <span className="flex size-4 shrink-0 items-center justify-center">
            <SpacePic shaderId={space?.shader} className="size-4" />
          </span>
          <h1 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
            {spaceTitle}
          </h1>
          <SidebarTrigger className="md:hidden" />
          <CaptureButton />
        </div>
        {hasCaptured ? (
          <div className="flex items-center justify-end gap-2 px-4 pb-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                {FACETS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.id}
                    className="font-normal text-xs"
                    checked={filters.has(item.id)}
                    onCheckedChange={() => toggleFilter(item.id)}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <LibrarySortMenu value={sort} onChange={setSort} />
            <LibraryViewToggle value={view} onChange={setView} />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasCaptured ? (
          <div className="px-4 pt-6 pb-24">
            <PageEmpty
              title="Nothing here yet"
              description="Capture a URL, text, or file into this space."
              action={<CaptureButton />}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 pt-6 pb-24">
            <PageEmpty
              title="No matches"
              description="Try a different search or filter."
            />
          </div>
        ) : (
          <ul
            className={
              view === "cards"
                ? cn(ITEM_CARD_GRID_CLASS, "px-4 pt-2 pb-24")
                : "flex flex-col divide-y divide-dashed divide-border pt-2 pb-24"
            }
          >
            {rows.map((row) => {
              const active = row.item?.id === openItem?.id;
              const shared = {
                selected: selected.has(row.key),
                dragging: draggingKeys.has(row.key),
                onOpen: () => openRow(row),
                onToggle: (checked: boolean) =>
                  toggleSelected(row.key, checked),
                onDelete: () => deleteMutation.mutate([row]),
                onDragStart: (event: DragEvent<HTMLLIElement>) => {
                  const ids = dragIdsFor(row);
                  if (ids.length === 0) {
                    event.preventDefault();
                    return;
                  }
                  setPworItemDrag(event, {
                    kind: row.kind,
                    ids,
                    title: row.title,
                    meta: row.typeLabel.toLowerCase(),
                    fromWorkspaceId: workspaceId,
                  });
                  setDraggingKeys(
                    new Set(
                      rows
                        .filter(
                          (item) =>
                            item.kind === row.kind &&
                            ids.includes(rowId(item) ?? ""),
                        )
                        .map((item) => item.key),
                    ),
                  );
                },
                onDragEnd: () => {
                  endPworItemDrag();
                  setDraggingKeys(new Set());
                },
              };

              if (view === "cards" && row.item) {
                return (
                  <ItemCard
                    key={row.key}
                    item={row.item}
                    active={Boolean(active)}
                    deleteDescription="This permanently removes it from this space. This can’t be undone."
                    {...shared}
                  />
                );
              }

              return (
                <LibraryListItem
                  key={row.key}
                  row={row}
                  active={Boolean(active)}
                  onOpenExternal={() => openRowExternal(row)}
                  {...shared}
                />
              );
            })}
          </ul>
        )}
        {hasNextPage ? <div ref={sentinelRef} className="h-8" /> : null}
      </div>
    </div>
  );

  const previewPane = openItem ? (
    <ItemPreview
      key={openItem.id}
      item={openItem}
      variant="panel"
      onClose={() => setOpenItem(null)}
    />
  ) : null;

  const selectionBar =
    selectedCount > 0 ? (
      <LibrarySelectionBar
        count={selectedCount}
        busy={busy}
        currentWorkspaceId={workspaceId}
        onClear={() => setSelected(new Set())}
        onMove={(nextWorkspaceId) =>
          moveMutation.mutate({
            items: selectedRows,
            workspaceId: nextWorkspaceId,
          })
        }
        onDelete={() => deleteMutation.mutate(selectedRows)}
      />
    ) : null;

  return (
    <SplitPreviewLayout
      list={listPane}
      preview={previewPane}
      previewOpen={previewOpen}
      overlay={selectionBar}
      listId="library-list"
      previewId="library-preview"
    />
  );
}
