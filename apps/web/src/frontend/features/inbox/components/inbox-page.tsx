import {
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
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState, type DragEvent } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipIconButton,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageEmpty } from "@components/page-empty";
import { CaptureButton } from "@features/command/components/capture-button";
import { SpacePic } from "@features/spaces/components/space-pic";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll";
import {
  deleteItem,
  inboxItemsInfiniteQueryOptions,
  updateItemProject,
  type Item,
} from "@features/items/api";
import { ItemHoverCard, ItemMention } from "@features/items/components/item-mention";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { LibraryViewToggle } from "@features/items/components/library-view-toggle";
import {
  ITEM_CARD_GRID_CLASS,
  ItemCard,
} from "@features/items/components/item-card";
import { ItemViewer } from "@features/items/components/item-viewer";
import { endPworItemDrag, setPworItemDrag } from "@features/items/lib/drag";
import {
  formatItemDate,
  kindLabel,
  sortItems,
  type ItemSort,
} from "@features/items/lib/list";
import { itemOpenHref } from "@features/items/lib/media";
import { useLibraryView } from "@features/items/lib/view";
import { workspacesQueryOptions } from "@features/workspaces/api";

export const inboxSearchSchema = z.object({
  item: z.string().optional(),
});

function InboxRow({
  item,
  selected,
  dragging,
  onOpen,
  onToggle,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  item: Item;
  selected: boolean;
  dragging: boolean;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  const title = item.title?.trim() || "Untitled";
  const didDrag = useRef(false);
  const externalHref = itemOpenHref(item);

  return (
    <AlertDialog>
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
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-no-drag]")) return;
          if (didDrag.current) {
            didDrag.current = false;
            return;
          }
          onOpen();
        }}
        className={cn(
          "group flex w-full cursor-grab items-center gap-2 px-4 py-2 select-none hover:bg-muted/40 active:cursor-grabbing",
          dragging && "opacity-40",
        )}
      >
        <span
          data-no-drag
          className="flex size-4 shrink-0 items-center justify-center"
        >
          <Checkbox
            checked={selected}
            aria-label={`Select ${title}`}
            className="after:hidden"
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
        </span>
        <ItemHoverCard item={item}>
          <ItemMention item={item} className="min-w-0 flex-1" />
        </ItemHoverCard>
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
            disabled={!externalHref}
            onClick={() => {
              if (externalHref) {
                window.open(externalHref, "_blank", "noopener,noreferrer");
              }
            }}
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
          {formatItemDate(item.createdAt)}
        </span>
      </li>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes it from Inbox. This can’t be undone.
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
  );
}

function InboxSelectionBar({
  count,
  busy,
  onClear,
  onMove,
  onDelete,
}: {
  count: number;
  busy: boolean;
  onClear: () => void;
  onMove: (workspaceId: string) => void;
  onDelete: () => void;
}) {
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);

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
                disabled={busy || spaces.length === 0}
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
            {spaces.map((space) => (
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
                Delete {count === 1 ? "capture" : `${count} captures`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes {count === 1 ? "it" : "them"} from
                Inbox. This can’t be undone.
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

export function InboxPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/inbox/" });
  const search = useSearch({ from: "/_app/inbox/" });
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(inboxItemsInfiniteQueryOptions());
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const sentinelRef = useInfiniteScrollSentinel(() => {
    if (!isFetchingNextPage) void fetchNextPage();
  }, hasNextPage);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());
  const [view, setView] = useLibraryView();
  const [sort, setSort] = useState<ItemSort>("newest");
  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);

  const selectedIds = items
    .map((item) => item.id)
    .filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;

  const openItem =
    search.item != null
      ? (items.find((item) => item.id === search.item) ?? null)
      : null;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0 && openItem == null,
    conflictBehavior: "replace",
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await deleteItem(id);
    },
    onSuccess: async (_result, ids) => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      if (search.item && ids.includes(search.item)) {
        void navigate({ search: { item: undefined }, replace: true });
      }
    },
    onError: () => toast.error("Couldn’t delete"),
  });

  const moveMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      for (const id of selectedIds) {
        await updateItemProject(id, workspaceId);
      }
    },
    onSuccess: async () => {
      const count = selectedIds.length;
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      toast.success(count > 1 ? `Moved ${count}` : "Moved");
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const busy = deleteMutation.isPending || moveMutation.isPending;

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function dragIdsFor(item: Item): string[] {
    if (selected.has(item.id) && selectedCount > 1) return selectedIds;
    return [item.id];
  }

  function itemProps(item: Item) {
    return {
      selected: selected.has(item.id),
      dragging: draggingIds.has(item.id),
      onOpen: () => void navigate({ search: { item: item.id }, replace: true }),
      onToggle: (checked: boolean) => toggleSelected(item.id, checked),
      onDelete: () => deleteMutation.mutate([item.id]),
      onDragStart: (event: DragEvent<HTMLLIElement>) => {
        const ids = dragIdsFor(item);
        setPworItemDrag(event, {
          kind: "item" as const,
          ids,
          title: item.title?.trim() || "Untitled",
          meta: kindLabel(item),
          fromWorkspaceId: null,
        });
        setDraggingIds(new Set(ids));
      },
      onDragEnd: () => {
        endPworItemDrag();
        setDraggingIds(new Set());
      },
    };
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <div className="flex h-12 w-full items-center gap-2 px-4">
          <h1 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
            Inbox
          </h1>
          <SidebarTrigger className="md:hidden" />
          <CaptureButton />
        </div>
        {items.length > 0 ? (
          <div className="flex items-center justify-end gap-2 px-4 pb-2">
            <LibrarySortMenu value={sort} onChange={setSort} />
            <LibraryViewToggle value={view} onChange={setView} />
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="h-full min-h-0 overflow-y-auto">
          <div className="pt-2 pb-24">
            {items.length === 0 ? (
              <div className="px-4 pt-4">
                <PageEmpty
                  title="Nothing yet"
                  description="Paste a link anywhere, capture from the extension, or forward email here."
                />
              </div>
            ) : (
              <ul
                className={
                  view === "cards"
                    ? cn(ITEM_CARD_GRID_CLASS, "px-4")
                    : "flex flex-col divide-y divide-dashed divide-border"
                }
              >
                {sorted.map((item) =>
                  view === "cards" ? (
                    <ItemCard
                      key={item.id}
                      item={item}
                      deleteDescription="This permanently removes it from Inbox. This can’t be undone."
                      {...itemProps(item)}
                    />
                  ) : (
                    <InboxRow key={item.id} item={item} {...itemProps(item)} />
                  ),
                )}
              </ul>
            )}
            {hasNextPage ? <div ref={sentinelRef} className="h-8" /> : null}
          </div>
        </div>

        {selectedCount > 0 ? (
          <InboxSelectionBar
            count={selectedCount}
            busy={busy}
            onClear={() => setSelected(new Set())}
            onMove={(workspaceId) => moveMutation.mutate(workspaceId)}
            onDelete={() => deleteMutation.mutate(selectedIds)}
          />
        ) : null}
      </div>

      {openItem ? (
        <ItemViewer
          item={openItem}
          open
          onOpenChange={(open) => {
            if (!open) {
              void navigate({ search: { item: undefined }, replace: true });
            }
          }}
        />
      ) : null}
    </div>
  );
}
