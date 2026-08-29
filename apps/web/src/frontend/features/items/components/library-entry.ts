import { useParams, useSearch } from "@tanstack/react-router";
import type { DragEvent, RefObject } from "react";

import { noteDisplayTitle } from "@shared/note-frontmatter";
import type { Item } from "@features/items/api";
import type { LibraryItemHandlers } from "@features/items/components/library-row";
import { endPworItemDrag, setPworItemDrag } from "@features/items/lib/drag";
import { itemTitle, kindLabel } from "@features/items/lib/list";
import type { NoteListItem } from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";

export type LibraryEntry =
  | { kind: "item"; item: Item }
  | { kind: "note"; note: NoteListItem };

export type LibraryCollectionProps = {
  entries: LibraryEntry[];
  selected: Set<string>;
  draggingIds: Set<string>;
  deleteDescription: string;
  fromSpaceId: string | null;
  hasNextPage: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  edgeToEdge?: boolean;
  onOpen: (entry: LibraryEntry) => void;
  onToggle: (id: string, checked: boolean) => void;
  onPin: (entry: LibraryEntry) => void;
  onDelete: (ids: string[]) => void;
  onDraggingIds: (ids: string[]) => void;
};

export function entryId(entry: LibraryEntry): string {
  switch (entry.kind) {
    case "item":
      return entry.item.id;
    case "note":
      return entry.note.id;
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}

export function useLibraryHandlers({
  entries,
  selected,
  draggingIds,
  fromSpaceId,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  onDraggingIds,
}: Pick<
  LibraryCollectionProps,
  | "entries"
  | "selected"
  | "draggingIds"
  | "fromSpaceId"
  | "onOpen"
  | "onToggle"
  | "onPin"
  | "onDelete"
  | "onDraggingIds"
>): (entry: LibraryEntry) => LibraryItemHandlers {
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
      .map(entryId)
      .filter((id) => selected.has(id));

  function dragIdsFor(entry: LibraryEntry): string[] {
    const id = entryId(entry);
    const ids = selectedOfKind(entry.kind);
    if (selected.has(id) && ids.length > 1) return ids;
    return [id];
  }

  return (entry: LibraryEntry): LibraryItemHandlers => {
    switch (entry.kind) {
      case "item": {
        const { item } = entry;
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
              fromSpaceId,
            });
            onDraggingIds(ids);
          },
          onDragEnd: () => {
            endPworItemDrag();
            onDraggingIds([]);
          },
        };
      }
      case "note": {
        const { note } = entry;
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
              fromSpaceId,
            });
            onDraggingIds(ids);
          },
          onDragEnd: () => {
            endPworItemDrag();
            onDraggingIds([]);
          },
        };
      }
      default: {
        const _exhaustive: never = entry;
        return _exhaustive;
      }
    }
  };
}
