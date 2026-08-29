import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { LibraryCard } from "@features/items/components/library-card";
import {
  entryId,
  useLibraryHandlers,
  type LibraryCollectionProps,
  type LibraryEntry,
} from "@features/items/components/library-entry";

export function LibraryMasonry({
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
  const { ref, count } = useMasonryColumns(edgeToEdge);
  const columns = splitColumns(entries, count);

  return (
    <>
      <div
        ref={ref}
        className={cn("flex gap-4 pb-24", edgeToEdge ? "px-3" : "px-4")}
      >
        {columns.map((column, index) => (
          <ul key={index} className="flex min-w-0 flex-1 flex-col gap-4">
            {column.map((entry) => (
              <LibraryCard
                key={entryId(entry)}
                entry={entry}
                variant="masonry"
                selecting={selecting}
                deleteDescription={deleteDescription}
                {...handlersFor(entry)}
              />
            ))}
          </ul>
        ))}
      </div>
      {hasNextPage ? <div ref={sentinelRef} className="h-8" /> : null}
    </>
  );
}

function splitColumns(
  entries: LibraryEntry[],
  count: number,
): LibraryEntry[][] {
  const columns = Array.from({ length: count }, () => [] as LibraryEntry[]);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry) columns[index % count]?.push(entry);
  }
  return columns;
}

function columnCount(width: number, compact: boolean) {
  if (compact) return width < 420 ? 1 : 2;
  if (width < 560) return 2;
  return 3;
}

function useMasonryColumns(compact: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(compact ? 2 : 3);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    function measure(width: number) {
      setCount(columnCount(width, compact));
    }

    measure(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) measure(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact]);

  return { ref, count };
}
