import { cn } from "../cn";
import type { SlashItem } from "./items";

export function SlashMenu({
  items,
  selected,
  onHover,
  onPick,
}: {
  items: SlashItem[];
  selected: number;
  onHover: (index: number) => void;
  onPick: (item: SlashItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="min-w-52 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground">
        No matches
      </div>
    );
  }

  let lastGroup: SlashItem["group"] | null = null;

  return (
    <div
      role="listbox"
      className="min-w-52 overflow-hidden rounded-md border border-border bg-background py-1"
    >
      {items.map((item, index) => {
        const showGroup = item.group !== lastGroup;
        lastGroup = item.group;
        const Icon = item.icon;
        return (
          <div key={item.name}>
            {showGroup ? (
              <div className="px-2 pt-1.5 pb-0.5 text-[10px] text-muted-foreground">
                {item.group === "turn into" ? "Turn into" : "Insert"}
              </div>
            ) : null}
            <button
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
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span>{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
