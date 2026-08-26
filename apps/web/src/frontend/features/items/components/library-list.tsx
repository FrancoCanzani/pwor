import { useParams, useSearch } from "@tanstack/react-router";
import type { DragEvent, RefObject } from "react";

import { noteDisplayTitle } from "@shared/note-frontmatter";
import type { Item } from "@features/items/api";
import { LibraryRow } from "@features/items/components/library-row";
import { endPworItemDrag, setPworItemDrag } from "@features/items/lib/drag";
import { kindLabel, itemTitle } from "@features/items/lib/list";
import type { NoteListItem } from "@features/notes/api";
import { NoteRow } from "@features/notes/components/note-row";
import { useFloatingNote } from "@features/notes/floating-note-context";

export type LibraryEntry =
  | { kind: "item"; item: Item }
  | { kind: "note"; note: NoteListItem };

export function itemEntries(items: Item[]): LibraryEntry[] {
  return items.map((item) => ({ kind: "item" as const, item }));
}

export function noteEntries(notes: NoteListItem[]): LibraryEntry[] {
  return notes.map((note) => ({ kind: "note" as const, note }));
}

export function LibraryList({
  entries,
  selected,
  draggingIds,
  deleteDescription,
  fromWorkspaceId,
  hasNextPage,
  sentinelRef,
  edgeToEdge = false,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  onDraggingIds,
}: {
  entries: LibraryEntry[];
  selected: Set<string>;
  draggingIds: Set<string>;
  deleteDescription: string;
  fromWorkspaceId: string | null;
  hasNextPage: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  edgeToEdge?: boolean;
  onOpen: (entry: LibraryEntry) => void;
  onToggle: (id: string, checked: boolean) => void;
  onPin: (entry: LibraryEntry) => void;
  onDelete: (ids: string[]) => void;
  onDraggingIds: (ids: string[]) => void;
}) {
  const search = useSearch({ strict: false });
  const params = useParams({ strict: false });
  const { activeNoteId } = useFloatingNote();
  const openId =
    (typeof params.noteId === "string" ? params.noteId : null) ??
    (typeof search.item === "string" ? search.item : null) ??
    activeNoteId;

  const selectedOfKind = (kind: LibraryEntry["kind"]) =>
    entries
      .filter((entry) => entry.kind === kind)
      .map((entry) => (entry.kind === "item" ? entry.item.id : entry.note.id))
      .filter((id) => selected.has(id));

  function dragIdsFor(entry: LibraryEntry): string[] {
    const id = entry.kind === "item" ? entry.item.id : entry.note.id;
    const ids = selectedOfKind(entry.kind);
    if (selected.has(id) && ids.length > 1) return ids;
    return [id];
  }

  function itemHandlers(item: Item) {
    const entry: LibraryEntry = { kind: "item", item };
    return {
      selected: selected.has(item.id),
      dragging: draggingIds.has(item.id),
      active: openId === item.id,
      onOpen: () => onOpen(entry),
      onToggle: (checked: boolean) => onToggle(item.id, checked),
      onPin: () => onPin(entry),
      onDelete: () => onDelete([item.id]),
      onDragStart: (event: DragEvent<HTMLLIElement>) => {
        const ids = dragIdsFor(entry);
        setPworItemDrag(event, {
          kind: "item",
          ids,
          title: itemTitle(item),
          meta: kindLabel(item),
          fromWorkspaceId,
        });
        onDraggingIds(ids);
      },
      onDragEnd: () => {
        endPworItemDrag();
        onDraggingIds([]);
      },
    };
  }

  function noteHandlers(note: NoteListItem) {
    const entry: LibraryEntry = { kind: "note", note };
    return {
      selected: selected.has(note.id),
      dragging: draggingIds.has(note.id),
      active: openId === note.id,
      onOpen: () => onOpen(entry),
      onToggle: (checked: boolean) => onToggle(note.id, checked),
      onPin: () => onPin(entry),
      onDelete: () => onDelete([note.id]),
      onDragStart: (event: DragEvent<HTMLLIElement>) => {
        const ids = dragIdsFor(entry);
        setPworItemDrag(event, {
          kind: "note",
          ids,
          title: noteDisplayTitle(note.title),
          meta: "note",
          fromWorkspaceId,
        });
        onDraggingIds(ids);
      },
      onDragEnd: () => {
        endPworItemDrag();
        onDraggingIds([]);
      },
    };
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-dashed divide-border pt-3 pb-24">
        {entries.map((entry) => {
          switch (entry.kind) {
            case "item":
              return (
                <LibraryRow
                  key={entry.item.id}
                  item={entry.item}
                  deleteDescription={deleteDescription}
                  edgeToEdge={edgeToEdge}
                  {...itemHandlers(entry.item)}
                />
              );
            case "note":
              return (
                <NoteRow
                  key={entry.note.id}
                  note={entry.note}
                  deleteDescription={deleteDescription}
                  edgeToEdge={edgeToEdge}
                  {...noteHandlers(entry.note)}
                />
              );
            default: {
              const _exhaustive: never = entry;
              return _exhaustive;
            }
          }
        })}
      </ul>
      {hasNextPage ? <div ref={sentinelRef} className="h-8" /> : null}
    </>
  );
}
