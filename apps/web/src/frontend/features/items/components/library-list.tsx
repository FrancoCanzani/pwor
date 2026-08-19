import type { RefObject, DragEvent } from "react";

import { cn } from "@/lib/utils";
import { noteDisplayTitle } from "@shared/note-frontmatter";
import type { Item } from "@features/items/api";
import {
  ITEM_CARD_GRID_CLASS,
  ItemCard,
} from "@features/items/components/item-card";
import { LibraryRow } from "@features/items/components/library-row";
import { endPworItemDrag, setPworItemDrag } from "@features/items/lib/drag";
import { kindLabel, itemTitle } from "@features/items/lib/list";
import type { LibraryView } from "@features/items/lib/view";
import type { NoteListItem } from "@features/notes/api";
import {
  NoteCard,
  NoteRow,
} from "@features/notes/components/note-card";

export type LibraryEntry =
  | { kind: "item"; item: Item }
  | { kind: "note"; note: NoteListItem };

export function itemEntries(items: Item[]): LibraryEntry[] {
  return items.map((item) => ({ kind: "item" as const, item }));
}

export function LibraryList({
  entries,
  view,
  openId,
  selected,
  draggingIds,
  deleteDescription,
  fromWorkspaceId,
  hasNextPage,
  sentinelRef,
  onOpen,
  onToggle,
  onDelete,
  onDraggingIds,
}: {
  entries: LibraryEntry[];
  view: LibraryView;
  openId: string | null;
  selected: Set<string>;
  draggingIds: Set<string>;
  deleteDescription: string;
  fromWorkspaceId: string | null;
  hasNextPage: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onOpen: (entry: LibraryEntry) => void;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (ids: string[]) => void;
  onDraggingIds: (ids: string[]) => void;
}) {
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
      <ul
        className={
          view === "cards"
            ? cn(ITEM_CARD_GRID_CLASS, "px-4 pt-3 pb-24")
            : "flex flex-col divide-y divide-dashed divide-border pt-3 pb-24"
        }
      >
        {entries.map((entry) => {
          switch (entry.kind) {
            case "item":
              return view === "cards" ? (
                <ItemCard
                  key={entry.item.id}
                  item={entry.item}
                  deleteDescription={deleteDescription}
                  {...itemHandlers(entry.item)}
                />
              ) : (
                <LibraryRow
                  key={entry.item.id}
                  item={entry.item}
                  deleteDescription={deleteDescription}
                  {...itemHandlers(entry.item)}
                />
              );
            case "note":
              return view === "cards" ? (
                <NoteCard
                  key={entry.note.id}
                  note={entry.note}
                  deleteDescription={deleteDescription}
                  {...noteHandlers(entry.note)}
                />
              ) : (
                <NoteRow
                  key={entry.note.id}
                  note={entry.note}
                  deleteDescription={deleteDescription}
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
