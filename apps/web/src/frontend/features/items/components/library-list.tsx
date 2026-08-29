import { LibraryRow } from "@features/items/components/library-row";
import {
  useLibraryHandlers,
  type LibraryCollectionProps,
  type LibraryEntry,
} from "@features/items/components/library-entry";
import { NoteRow } from "@features/notes/components/note-row";

export type { LibraryEntry };

export function LibraryList({
  entries,
  selected,
  draggingIds,
  deleteDescription,
  fromSpaceId,
  hasNextPage,
  sentinelRef,
  edgeToEdge = false,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  onDraggingIds,
}: LibraryCollectionProps) {
  const handlersFor = useLibraryHandlers({
    entries,
    selected,
    draggingIds,
    fromSpaceId,
    onOpen,
    onToggle,
    onPin,
    onDelete,
    onDraggingIds,
  });

  return (
    <>
      <ul className="flex flex-col divide-y divide-dashed divide-border pb-24">
        {entries.map((entry, index) => {
          const first = index === 0;
          const last = index === entries.length - 1;
          switch (entry.kind) {
            case "item":
              return (
                <LibraryRow
                  key={entry.item.id}
                  item={entry.item}
                  deleteDescription={deleteDescription}
                  edgeToEdge={edgeToEdge}
                  first={first}
                  last={last}
                  {...handlersFor(entry)}
                />
              );
            case "note":
              return (
                <NoteRow
                  key={entry.note.id}
                  note={entry.note}
                  deleteDescription={deleteDescription}
                  edgeToEdge={edgeToEdge}
                  first={first}
                  last={last}
                  {...handlersFor(entry)}
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
