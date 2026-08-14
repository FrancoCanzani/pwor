import { ViewGridIcon, ViewHorizontalIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LibraryView } from "@features/items/lib/view";

function ViewButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={label}
            aria-pressed={pressed}
            className={cn(
              "font-normal",
              pressed ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function LibraryViewToggle({
  value,
  onChange,
}: {
  value: LibraryView;
  onChange: (view: LibraryView) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <ViewButton
        label="List"
        pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        <ViewHorizontalIcon />
      </ViewButton>
      <ViewButton
        label="Cards"
        pressed={value === "cards"}
        onClick={() => onChange("cards")}
      >
        <ViewGridIcon />
      </ViewButton>
    </span>
  );
}
