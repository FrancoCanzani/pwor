import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Kbd } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageEmpty } from "@components/page-empty";
import { SplitPreviewLayout } from "@components/split-preview-layout";
import { userInboxQueryOptions } from "@features/inbox/api";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll";
import {
  deleteItem,
  inboxItemsInfiniteQueryOptions,
  updateItemWorkspace,
  type Item,
} from "@features/items/api";
import { ItemPreview } from "@features/items/components/item-preview";
import { LibraryList, itemEntries } from "@features/items/components/library-list";
import { LibrarySelectionBar } from "@features/items/components/library-selection-bar";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { LibraryViewToggle } from "@features/items/components/library-view-toggle";
import { sortItems, type ItemSort } from "@features/items/lib/list";
import { useLibraryView } from "@features/items/lib/view";

export const inboxSearchSchema = z.object({
  item: z.string().optional(),
});

export function InboxPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/inbox/" });
  const search = useSearch({ from: "/_app/inbox/" });
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(inboxItemsInfiniteQueryOptions());
  const inbox = useQuery(userInboxQueryOptions());
  const address = inbox.data?.address;
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

  const selectedIds = sorted
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
        await updateItemWorkspace(id, workspaceId);
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

  function setOpenItem(item: Item | null) {
    void navigate({
      search: item ? { item: item.id } : { item: undefined },
      replace: true,
    });
  }

  const deleteDescription =
    "This permanently removes it from Inbox. This can’t be undone.";

  const listPane = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0">
        <div className="flex h-12 w-full items-center gap-2 px-4">
          <h1 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
            Inbox
          </h1>
          <SidebarTrigger className="md:hidden" />
        </div>
        {items.length > 0 ? (
          <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-4">
            <LibrarySortMenu value={sort} onChange={setSort} />
            <LibraryViewToggle value={view} onChange={setView} />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 pt-6 pb-24">
            <PageEmpty
              title="Nothing yet"
              description={
                <span className="flex flex-col items-center gap-1.5">
                  <span className="flex items-center justify-center gap-1">
                    <Kbd>⌘U</Kbd>
                    to capture. Paste a link anywhere.
                  </span>
                  {address ? (
                    <button
                      type="button"
                      className="font-nums text-muted-foreground hover:text-foreground hover:underline"
                      onClick={() => {
                        void navigator.clipboard.writeText(address);
                        toast.success("Copied");
                      }}
                    >
                      {address}
                    </button>
                  ) : null}
                </span>
              }
            />
          </div>
        ) : (
          <LibraryList
            entries={itemEntries(sorted)}
            view={view}
            openId={openItem?.id ?? null}
            selected={selected}
            draggingIds={draggingIds}
            deleteDescription={deleteDescription}
            fromWorkspaceId={null}
            hasNextPage={Boolean(hasNextPage)}
            sentinelRef={sentinelRef}
            onOpen={(entry) => {
              if (entry.kind === "item") setOpenItem(entry.item);
            }}
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
        deleteTitle={
          selectedCount === 1 ? "Delete capture?" : `Delete ${selectedCount} captures?`
        }
        deleteDescription={`This permanently removes ${selectedCount === 1 ? "it" : "them"} from Inbox. This can’t be undone.`}
        onClear={() => setSelected(new Set())}
        onMove={(workspaceId) => moveMutation.mutate(workspaceId)}
        onDelete={() => deleteMutation.mutate(selectedIds)}
      />
    ) : null;

  return (
    <SplitPreviewLayout
      list={listPane}
      preview={previewPane}
      previewOpen={openItem != null}
      overlay={selectionBar}
      listId="inbox-list"
      previewId="inbox-preview"
    />
  );
}
