import { DrawingPinFilledIcon } from "@radix-ui/react-icons";
import { useRef, type DragEvent } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";
import { LibraryItemMenus } from "@features/items/components/library-item-menus";
import { ItemHoverCard, ItemMention } from "@features/items/components/item-mention";
import { formatItemDate, itemTitle } from "@features/items/lib/list";
import { itemFileUrl, itemOpenHref } from "@features/items/lib/media";

export type LibraryItemHandlers = {
  selected: boolean;
  dragging: boolean;
  active: boolean;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onPin: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
};

export function LibraryRow({
  item,
  selected,
  dragging,
  active,
  deleteDescription,
  edgeToEdge = false,
  first = false,
  last = false,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  item: Item;
  deleteDescription: string;
  edgeToEdge?: boolean;
  first?: boolean;
  last?: boolean;
} & LibraryItemHandlers) {
  const title = itemTitle(item);
  const didDrag = useRef(false);
  const pending = item.parseStatus === "pending";

  function handleOpen() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onOpen();
  }

  return (
    <LibraryItemMenus
      title={title}
      deleteDescription={deleteDescription}
      pinned={item.pinned}
      externalHref={itemOpenHref(item)}
      downloadHref={item.kind !== "link" ? itemFileUrl(item.id) : null}
      onOpen={onOpen}
      onToggle={onToggle}
      onPin={onPin}
      onDelete={onDelete}
    >
      <ContextMenuTrigger
        render={
          <li
            draggable
            onDragStart={(event) => {
              if ((event.target as HTMLElement).closest("[data-no-drag]")) {
                event.preventDefault();
                return;
              }
              didDrag.current = true;
              onDragStart(event);
            }}
            onDragEnd={onDragEnd}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("[data-no-drag]")) {
                return;
              }
              handleOpen();
            }}
            className={cn(
              "group flex w-full cursor-grab items-center gap-2 py-2 select-none hover:bg-muted/40 active:cursor-grabbing",
              edgeToEdge ? "px-3" : "px-4",
              first && "rounded-t-lg",
              last && "rounded-b-lg",
              active && "bg-muted/50",
              pending && "animate-pulse",
              dragging && "opacity-40",
            )}
          />
        }
      >
        <span
          data-no-drag
          className="flex size-4 shrink-0 items-center justify-center"
        >
          <Checkbox
            checked={selected}
            aria-label={`Select ${title}`}
            className="after:hidden"
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
        </span>
        <ItemHoverCard item={item}>
          <ItemMention item={item} className="min-w-0 flex-1" />
        </ItemHoverCard>
        {item.pinned ? (
          <DrawingPinFilledIcon className="size-3 shrink-0 text-muted-foreground" />
        ) : null}
        <span className="shrink-0 text-xs font-nums text-muted-foreground">
          {formatItemDate(item.createdAt)}
        </span>
      </ContextMenuTrigger>
    </LibraryItemMenus>
  );
}
