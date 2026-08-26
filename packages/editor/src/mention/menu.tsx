import { cn } from "../cn";
import type { MentionItem } from "../types";

export function MentionMenu({
  items,
  selected,
  onHover,
  onPick,
}: {
  items: readonly MentionItem[];
  selected: number;
  onHover: (index: number) => void;
  onPick: (item: MentionItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="min-w-52 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground">
        No matches
      </div>
    );
  }

  return (
    <div
      role="listbox"
      className="min-w-52 overflow-hidden rounded-md border border-border bg-background py-1"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === selected}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1 text-left text-xs font-normal",
            index === selected ? "bg-muted" : "bg-transparent",
          )}
          onMouseEnter={() => onHover(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item);
          }}
        >
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
