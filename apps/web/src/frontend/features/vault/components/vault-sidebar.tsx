import { cn } from "@/lib/utils";
import type { VaultItem } from "@features/vault/api";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  categoryOf,
  type VaultCategory,
} from "@features/vault/lib/category";

export function VaultSidebar({
  items,
  selected,
  onSelect,
  className,
}: {
  items: VaultItem[];
  selected: VaultCategory | null;
  onSelect: (category: VaultCategory | null) => void;
  className?: string;
}) {
  const counts = new Map<VaultCategory, number>();
  for (const item of items) {
    const category = categoryOf(item);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col md:border-r md:border-border/40",
        className,
      )}
    >
      <div className="flex h-12 shrink-0 items-center px-4">
        <h1 className="text-xs leading-none font-normal text-muted-foreground">
          Vault
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-2 pb-3">
        <ul className="flex flex-col gap-0.5">
          <li>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                selected === null
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              All
              <span className="font-nums">{items.length}</span>
            </button>
          </li>
          {CATEGORY_ORDER.map((category) => (
            <li key={category}>
              <button
                type="button"
                onClick={() => onSelect(category)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  selected === category
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {CATEGORY_LABEL[category]}
                <span className="font-nums">
                  {counts.get(category) ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
