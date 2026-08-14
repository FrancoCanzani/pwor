import { ChevronRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Item } from "@features/items/api";
import { ItemNewButton } from "@features/items/components/item-new-dialog";
import {
  TYPE_FACET_LABEL,
  TYPE_FACET_ORDER,
  typeFacetOf,
  type ItemTypeFacet,
} from "@features/items/lib/facet";
import type { ItemNav } from "@features/items/lib/list";
import { formatGb } from "@features/items/lib/size";

function NavButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center rounded-md py-1.5 pr-8 pl-2 text-left text-xs transition-colors select-none",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted/60 active:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className="font-nums absolute top-1/2 right-2 -translate-y-1/2">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function FacetSidebar({
  items,
  totalBytes,
  nav,
  onNavChange,
  className,
}: {
  items: Item[];
  totalBytes: number;
  nav: ItemNav;
  onNavChange: (nav: ItemNav) => void;
  className?: string;
}) {
  const typeCounts = new Map<ItemTypeFacet, number>();
  for (const item of items) {
    const facet = typeFacetOf(item);
    typeCounts.set(facet, (typeCounts.get(facet) ?? 0) + 1);
  }

  const typeLabel = nav.mode === "type" ? TYPE_FACET_LABEL[nav.type] : "Types";

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col md:border-r md:border-border/40",
        className,
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
        <h1 className="text-xs leading-none font-normal text-muted-foreground">
          Item
        </h1>
        <ItemNewButton />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-2 pb-3">
        <ul className="flex flex-col gap-0.5">
          <li>
            <NavButton
              active={nav.mode === "all"}
              label="All"
              count={items.length}
              onClick={() => onNavChange({ mode: "all" })}
            />
          </li>
        </ul>

        <div className="mt-4 px-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "relative flex h-8 w-full items-center rounded-md py-1.5 pr-8 pl-2 text-left text-xs transition-colors select-none",
                    nav.mode === "type"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted/60 active:text-foreground",
                  )}
                />
              }
            >
              <span className="truncate">{typeLabel}</span>
              <ChevronRightIcon className="absolute top-1/2 right-2 size-3 -translate-y-1/2 rotate-90" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              {TYPE_FACET_ORDER.map((facet) => (
                <DropdownMenuItem
                  key={facet}
                  className="font-normal text-xs"
                  onClick={() => onNavChange({ mode: "type", type: facet })}
                >
                  <span className="flex-1 truncate">
                    {TYPE_FACET_LABEL[facet]}
                  </span>
                  <span className="font-nums text-muted-foreground">
                    {typeCounts.get(facet) ?? 0}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center px-4">
        <span className="font-nums text-xs text-muted-foreground">
          {formatGb(totalBytes)}
        </span>
      </div>
    </aside>
  );
}
