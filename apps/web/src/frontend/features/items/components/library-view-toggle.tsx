import {
  DashboardIcon,
  RowsIcon,
  ViewGridIcon,
} from "@radix-ui/react-icons";
import type { ComponentType } from "react";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  LIBRARY_VIEW_LABEL,
  LIBRARY_VIEW_ORDER,
  isLibraryViewMode,
  type LibraryViewMode,
} from "@features/items/lib/view";

const VIEW_ICON: Record<
  LibraryViewMode,
  ComponentType<{ className?: string }>
> = {
  list: RowsIcon,
  grid: ViewGridIcon,
  masonry: DashboardIcon,
};

export function LibraryViewToggle({
  value,
  onChange,
  modes = LIBRARY_VIEW_ORDER,
}: {
  value: LibraryViewMode;
  onChange: (view: LibraryViewMode) => void;
  modes?: readonly LibraryViewMode[];
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        const view = next[0];
        if (isLibraryViewMode(view) && modes.includes(view)) onChange(view);
      }}
      variant="outline"
      spacing={0}
      size="sm"
      className="shrink-0"
      aria-label="Layout"
    >
      {modes.map((view) => {
        const Icon = VIEW_ICON[view];
        return (
          <ToggleGroupItem
            key={view}
            value={view}
            aria-label={LIBRARY_VIEW_LABEL[view]}
            className="px-1.5 font-normal text-muted-foreground data-[pressed]:text-foreground"
          >
            <Icon />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
