import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageEmpty } from "@components/page-empty";
import { LibraryHeader, ContentColumn } from "@features/items/components/library-header";
import { LibraryList } from "@features/items/components/library-list";
import { LibrarySelectionBar } from "@features/items/components/library-selection-bar";
import { LibrarySortMenu } from "@features/items/components/library-sort";
import { sortBy, type ItemSort } from "@features/items/lib/list";
import {
  createNote,
  deleteNotes,
  noteQueryOptions,
  notesDeleteKey,
  notesMoveKey,
  notesPinKey,
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
    mutationKey: notesDeleteKey,
    mutationFn: (ids: string[]) => deleteNotes(ids),
    onMutate: (ids) => {
      setSelected((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
    },
    onError: () => toast.error("Couldn’t delete"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  const moveMutation = useMutation({
    mutationKey: notesMoveKey,
    mutationFn: (vars: { ids: string[]; spaceId: string }) =>
      updateNotes(vars.ids, { spaceId: vars.spaceId }),
    onMutate: (vars) => {
      setSelected((current) => {
        const next = new Set(current);
        for (const id of vars.ids) next.delete(id);
        return next;
      });
    },
    onSuccess: (_result, vars) => {
      toast.success(vars.ids.length > 1 ? `Moved ${vars.ids.length}` : "Moved");
    },
    onError: () => toast.error("Couldn’t move note"),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["spaces"] }),
      ]),
  });

  const pinMutation = useMutation({
    mutationKey: notesPinKey,
    mutationFn: (entry: { id: string; pinned: boolean }) =>
      updateNote(entry.id, { pinned: entry.pinned }),
    onError: () => toast.error("Couldn’t pin note"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  const deleting = useMutationState({
    filters: { mutationKey: notesDeleteKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string[] | undefined,
  });
  const moving = useMutationState({
    filters: { mutationKey: notesMoveKey, status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as { ids: string[] } | undefined)?.ids,
  });
  const pinning = useMutationState({
    filters: { mutationKey: notesPinKey, status: "pending" },
    select: (mutation) =>
      mutation.state.variables as { id: string; pinned: boolean } | undefined,
  });

  const hasNotes = notes.length > 0;
  const hiding = deleting.length > 0 || moving.length > 0;
  const entries = useMemo(() => {
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
    const q = query.trim().toLowerCase();
    const filtered = notes
      .filter((note) => !hidden.has(note.id))
      .map((note) => {
        const pinned = pinById.get(note.id);
        return pinned === undefined ? note : { ...note, pinned };
      })
      .filter((note) => {
        if (!q) return true;
        const haystack = [noteDisplayTitle(note.title), note.bodyPreview]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    return sortBy(filtered, sort, {
      date: (note) => new Date(note.updatedAt).toISOString(),
      name: (note) => noteDisplayTitle(note.title),
      pinned: (note) => Boolean(note.pinned),
    }).map((note) => ({ kind: "note" as const, note }));
  }, [notes, sort, query, deleting, moving, pinning]);

  const selectedIds = entries.flatMap((entry) =>
    entry.kind === "note" && selected.has(entry.note.id) ? [entry.note.id] : [],
  );
  const selectedCount = selectedIds.length;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0,
    conflictBehavior: "replace",
  });

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LibraryHeader
          leading={
            <h1 className="min-w-0 truncate text-base leading-none font-normal tracking-tight">
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
                <div className="ml-auto">
                  <LibrarySortMenu value={sort} onChange={setSort} />
                </div>
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
          <ContentColumn>
          {!hasNotes ? (
            <div className="px-4 pt-8 pb-24">
              <PageEmpty
                title="No notes yet"
                description="A blank page, whenever you need one."
              />
            </div>
          ) : entries.length === 0 && !hiding ? (
            <div className="px-4 pt-8 pb-24">
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
                    pinned: !entry.note.pinned,
                  });
                }
              }}
              onDelete={(ids) => deleteMutation.mutate(ids)}
              onDraggingIds={(ids) => setDraggingIds(new Set(ids))}
            />
          )}
          </ContentColumn>
        </div>
      </div>

      {selectedCount > 0 ? (
        <LibrarySelectionBar
          count={selectedCount}
          busy={false}
          excludeSpaceId={spaceId}
          deleteTitle={
            selectedCount === 1
              ? "Delete note?"
              : `Delete ${selectedCount} notes?`
          }
          deleteDescription={`This permanently deletes ${selectedCount === 1 ? "it" : "them"}. This can’t be undone.`}
          onClear={() => setSelected(new Set())}
          onMove={(nextSpaceId) =>
            moveMutation.mutate({ ids: selectedIds, spaceId: nextSpaceId })
          }
          onDelete={() => deleteMutation.mutate(selectedIds)}
        />
      ) : null}
    </div>
  );
}
