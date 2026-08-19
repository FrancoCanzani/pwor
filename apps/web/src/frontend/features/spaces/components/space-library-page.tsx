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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll";
import { noteDisplayTitle } from "@shared/note-frontmatter";
import { PageEmpty } from "@components/page-empty";
import { SplitPreviewLayout } from "@components/split-preview-layout";
import { SpacePic } from "@features/spaces/components/space-pic";
import {
  deleteItem,
  updateItemWorkspace,
  itemsInfiniteQueryOptions,
  type Item,
} from "@features/items/api";
import { ItemPreview } from "@features/items/components/item-preview";
import {
  LibraryList,
  type LibraryEntry,
} from "@features/items/components/library-list";
import { LibrarySelectionBar } from "@features/items/components/library-selection-bar";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { LibraryViewToggle } from "@features/items/components/library-view-toggle";
import {
  TYPE_FACET_LABEL,
  TYPE_FACET_ORDER,
  typeFacetOf,
  type ItemTypeFacet,
} from "@features/items/lib/facet";
import { sortBy, itemTitle, type ItemSort } from "@features/items/lib/list";
import { useLibraryView } from "@features/items/lib/view";
import {
  deleteNote,
  isStandaloneNote,
  notesQueryOptions,
  updateNoteWorkspace,
} from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import {
  deleteWorkspace,
  workspacesQueryOptions,
} from "@features/workspaces/api";

export function SpaceLibraryPage() {
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const search = useSearch({ from: "/_app/$workspaceId/" });
  const navigate = useNavigate({ from: "/$workspaceId/" });
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<ItemTypeFacet>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());
  const [view, setView] = useLibraryView();
  const [sort, setSort] = useState<ItemSort>("newest");

  const { openNote, activeNoteId } = useFloatingNote();
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
  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));
  const standaloneNotes = useMemo(
    () => notes.filter(isStandaloneNote),
    [notes],
  );
  const hasCaptured = items.length > 0 || standaloneNotes.length > 0;
  const sentinelRef = useInfiniteScrollSentinel(() => {
    if (!isFetchingNextPage) void fetchNextPage();
  }, hasNextPage);

  const filterLabel =
    filters.size === 0
      ? "All"
      : TYPE_FACET_ORDER.filter((id) => filters.has(id))
          .map((id) => TYPE_FACET_LABEL[id])
          .join(", ");

  const noteIds = useMemo(
    () => new Set(standaloneNotes.map((note) => note.id)),
    [standaloneNotes],
  );

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mixed: LibraryEntry[] = [];
    for (const item of items) {
      if (filters.size > 0 && !filters.has(typeFacetOf(item))) continue;
      if (q) {
        const haystack = [
          itemTitle(item),
          item.title,
          item.summary,
          ...(item.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      mixed.push({ kind: "item", item });
    }
    if (filters.size === 0) {
      for (const note of standaloneNotes) {
        if (q) {
          const haystack = [noteDisplayTitle(note.title), note.bodyPreview]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) continue;
        }
        mixed.push({ kind: "note", note });
      }
    }
    return sortBy(mixed, sort, {
      date: (entry) =>
        entry.kind === "item"
          ? entry.item.createdAt
          : new Date(entry.note.updatedAt).toISOString(),
      name: (entry) =>
        entry.kind === "item"
          ? itemTitle(entry.item)
          : noteDisplayTitle(entry.note.title),
    });
  }, [items, standaloneNotes, filters, query, sort]);

  const selectedIds = entries
    .map((entry) => (entry.kind === "item" ? entry.item.id : entry.note.id))
    .filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0 && search.item == null,
    conflictBehavior: "replace",
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryOptions.queryKey,
        exact: true,
      });
      void navigate({ to: "/inbox" });
    },
    onError: () => toast.error("Couldn’t delete space"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        if (noteIds.has(id)) await deleteNote(id);
        else await deleteItem(id);
      }
    },
    onSuccess: async (_result, ids) => {
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
      ]);
      if (search.item && ids.includes(search.item)) {
        void navigate({ search: {}, replace: true });
      }
    },
    onError: () => toast.error("Couldn’t delete"),
  });

  const moveMutation = useMutation({
    mutationFn: async (nextWorkspaceId: string) => {
      for (const id of selectedIds) {
        if (noteIds.has(id)) await updateNoteWorkspace(id, nextWorkspaceId);
        else await updateItemWorkspace(id, nextWorkspaceId);
      }
    },
    onSuccess: async (_result, nextWorkspaceId) => {
      const count = selectedIds.length;
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      if (search.item && selectedIds.includes(search.item)) {
        void navigate({ search: {}, replace: true });
      }
      const destination =
        workspaces.find((item) => item.id === nextWorkspaceId)?.name.trim() ||
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
    void navigate({
      search: item ? { item: item.id } : {},
      replace: true,
    });
  }

  function openEntry(entry: LibraryEntry) {
    switch (entry.kind) {
      case "item":
        setOpenItem(entry.item);
        return;
      case "note":
        openNote(entry.note.id);
        return;
      default: {
        const _exhaustive: never = entry;
        return _exhaustive;
      }
    }
  }

  const openItem =
    search.item != null
      ? (items.find((item) => item.id === search.item) ?? null)
      : null;

  const deleteDescription =
    "This permanently removes it from this space. This can’t be undone.";

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
                <AlertDialogTitle>Delete {spaceTitle}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the space and everything in it. This
                  can’t be undone.
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
        </div>
        {hasCaptured ? (
          <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-4">
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
              description={
                <span className="flex items-center justify-center gap-1">
                  <Kbd>⌘U</Kbd>
                  to capture, or write a note.
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
            view={view}
            openId={activeNoteId ?? openItem?.id ?? null}
            selected={selected}
            draggingIds={draggingIds}
            deleteDescription={deleteDescription}
            fromWorkspaceId={workspaceId}
            hasNextPage={Boolean(hasNextPage)}
            sentinelRef={sentinelRef}
            onOpen={openEntry}
            onToggle={toggleSelected}
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
        excludeWorkspaceId={workspaceId}
        deleteTitle={
          selectedCount === 1 ? "Delete item?" : `Delete ${selectedCount} items?`
        }
        deleteDescription={`This permanently removes ${selectedCount === 1 ? "it" : "them"} from this space. This can’t be undone.`}
        onClear={() => setSelected(new Set())}
        onMove={(nextWorkspaceId) => moveMutation.mutate(nextWorkspaceId)}
        onDelete={() => deleteMutation.mutate(selectedIds)}
      />
    ) : null;

  return (
    <SplitPreviewLayout
      list={listPane}
      preview={previewPane}
      previewOpen={openItem != null}
      overlay={selectionBar}
      listId="library-list"
      previewId="library-preview"
    />
  );
}
