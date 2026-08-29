import { cn } from "@/lib/utils";
import { LibraryCard } from "@features/items/components/library-card";
import {
  entryId,
  useLibraryHandlers,
  type LibraryCollectionProps,
} from "@features/items/components/library-entry";

export function LibraryGrid({
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
  const selecting = selected.size > 0;

  return (
    <>
      <ul
        className={cn(
          "grid gap-4 pb-24",
          edgeToEdge ? "grid-cols-2 px-3" : "grid-cols-3 px-4",
        )}
      >
        {entries.map((entry) => (
          <LibraryCard
            key={entryId(entry)}
            entry={entry}
            variant="grid"
            selecting={selecting}
            deleteDescription={deleteDescription}
            {...handlersFor(entry)}
          />
        ))}
      </ul>
      {hasNextPage ? <div ref={sentinelRef} className="h-8" /> : null}
    </>
  );
}
