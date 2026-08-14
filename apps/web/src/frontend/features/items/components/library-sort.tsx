import { CaretSortIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ITEM_SORT_LABEL,
  ITEM_SORT_ORDER,
  type ItemSort,
} from "@features/items/lib/list";

export function LibrarySortMenu({
  value,
  onChange,
}: {
  value: ItemSort;
  onChange: (sort: ItemSort) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 font-normal text-muted-foreground"
          />
        }
      >
        <span className="truncate">{ITEM_SORT_LABEL[value]}</span>
        <CaretSortIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-28 shadow-none">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (
              next === "newest" ||
              next === "oldest" ||
              next === "name"
            ) {
              onChange(next);
            }
          }}
        >
          {ITEM_SORT_ORDER.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className="font-normal text-xs"
            >
              {ITEM_SORT_LABEL[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
