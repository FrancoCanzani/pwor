import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageEmpty } from "@components/page-empty";
import { LibraryHeader } from "@features/items/components/library-header";
import {
  LibraryList,
  noteEntries,
} from "@features/items/components/library-list";
import { LibrarySelectionBar } from "@features/items/components/library-selection-bar";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { sortBy, type ItemSort } from "@features/items/lib/list";
import {
  createNote,
  deleteNotes,
  noteQueryOptions,
  notesQueryOptions,
  updateNote,
  updateNotes,
} from "@features/notes/api";
import { useCurrentSpace } from "@features/spaces/lib/use-current-space";
import { noteDisplayTitle } from "@shared/note-frontmatter";

export function NotesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: spaceId } = useCurrentSpace();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<ItemSort>("newest");

  const { data: notes = [] } = useQuery({
    ...notesQueryOptions(spaceId),
    enabled: Boolean(spaceId),
  });

  const hasNotes = notes.length > 0;
  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? notes.filter((note) => {
          const haystack = [noteDisplayTitle(note.title), note.bodyPreview]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : notes;
    return noteEntries(
      sortBy(filtered, sort, {
        date: (note) => new Date(note.updatedAt).toISOString(),
        name: (note) => noteDisplayTitle(note.title),
        pinned: (note) => Boolean(note.pinned),
      }),
    );
  }, [notes, sort, query]);

  const selectedIds = notes
    .map((note) => note.id)
    .filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0,
    conflictBehavior: "replace",
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!spaceId) throw new Error("No space");
      return createNote({ spaceId });
    },
    onSuccess: async (created) => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      void navigate({
        to: "/notes/$noteId",
        params: { noteId: created.id },
      });
    },
    onError: () => toast.error("Couldn’t create note"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteNotes(ids),
    onSuccess: async () => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: () => toast.error("Couldn’t delete"),
  });

  const moveMutation = useMutation({
    mutationFn: (nextSpaceId: string) =>
      updateNotes(selectedIds, { spaceId: nextSpaceId }),
    onSuccess: async () => {
      const count = selectedIds.length;
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["spaces"] }),
      ]);
      toast.success(count > 1 ? `Moved ${count}` : "Moved");
    },
    onError: () => toast.error("Couldn’t move note"),
  });

  const pinMutation = useMutation({
    mutationFn: (entry: { id: string; pinned: boolean }) =>
      updateNote(entry.id, { pinned: !entry.pinned }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: () => toast.error("Couldn’t pin note"),
  });

  const busy =
    deleteMutation.isPending ||
    moveMutation.isPending ||
    createMutation.isPending;

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LibraryHeader
          leading={
            <h1 className="shrink-0 text-base leading-none font-normal">
              Notes
            </h1>
          }
          toolbar={
            hasNotes ? (
              <>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search…"
                  className="h-7 min-w-0 max-w-[12rem] text-xs sm:max-w-xs"
                />
                <LibrarySortMenu value={sort} onChange={setSort} />
              </>
            ) : null
          }
          trailing={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="font-normal text-muted-foreground"
              disabled={!spaceId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              New
            </Button>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!hasNotes ? (
            <div className="px-4 pt-6 pb-24">
              <PageEmpty
                title="No notes yet"
                description="A blank page, whenever you need one."
              />
            </div>
          ) : entries.length === 0 ? (
            <div className="px-4 pt-6 pb-24">
              <PageEmpty
                title="No matches"
                description="Try a different search."
              />
            </div>
          ) : (
            <LibraryList
              entries={entries}
              selected={selected}
              draggingIds={draggingIds}
              deleteDescription="This permanently deletes the note. This can’t be undone."
              fromSpaceId={spaceId ?? null}
              hasNextPage={false}
              sentinelRef={sentinelRef}
              onOpen={(entry) => {
                if (entry.kind !== "note") return;
                void queryClient.prefetchQuery(noteQueryOptions(entry.note.id));
                void navigate({
                  to: "/notes/$noteId",
                  params: { noteId: entry.note.id },
                });
              }}
              onToggle={toggleSelected}
              onPin={(entry) => {
                if (entry.kind === "note") {
                  pinMutation.mutate({
                    id: entry.note.id,
                    pinned: Boolean(entry.note.pinned),
                  });
                }
              }}
              onDelete={(ids) => deleteMutation.mutate(ids)}
              onDraggingIds={(ids) => setDraggingIds(new Set(ids))}
            />
          )}
        </div>
      </div>

      {selectedCount > 0 ? (
        <LibrarySelectionBar
          count={selectedCount}
          busy={busy}
          excludeSpaceId={spaceId}
          deleteTitle={
            selectedCount === 1
              ? "Delete note?"
              : `Delete ${selectedCount} notes?`
          }
          deleteDescription={`This permanently deletes ${selectedCount === 1 ? "it" : "them"}. This can’t be undone.`}
          onClear={() => setSelected(new Set())}
          onMove={(nextSpaceId) => moveMutation.mutate(nextSpaceId)}
          onDelete={() => deleteMutation.mutate(selectedIds)}
        />
      ) : null}
    </div>
  );
}
