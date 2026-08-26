import { useRef, type DragEvent } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";
import { ItemHoverCard, ItemMention } from "@features/items/components/item-mention";
import { formatItemDate, itemTitle } from "@features/items/lib/list";
import { itemFileUrl, itemOpenHref } from "@features/items/lib/media";

export type LibraryItemHandlers = {
  selected: boolean;
  dragging: boolean;
  active: boolean;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
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
  onOpen,
  onToggle,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  item: Item;
  deleteDescription: string;
  edgeToEdge?: boolean;
} & LibraryItemHandlers) {
  const title = itemTitle(item);
  const didDrag = useRef(false);
  const externalHref = itemOpenHref(item);
  const downloadHref =
    item.kind !== "link" ? itemFileUrl(item.id) : null;
  const pending = item.parseStatus === "pending";

  function handleOpen() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onOpen();
  }

  function openExternal() {
    if (!externalHref) return;
    const tab = window.open(externalHref, "_blank");
    if (tab) tab.opener = null;
  }

  return (
    <ContextMenu>
      <AlertDialog>
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
          <span className="shrink-0 text-xs font-nums text-muted-foreground">
            {formatItemDate(item.createdAt)}
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent className="shadow-none">
          <ContextMenuGroup>
            <ContextMenuItem className="font-normal text-xs" onClick={onOpen}>
              Preview
            </ContextMenuItem>
            <ContextMenuItem
              className="font-normal text-xs"
              disabled={!externalHref}
              onClick={openExternal}
            >
              Open in new tab
            </ContextMenuItem>
            {downloadHref ? (
              <ContextMenuItem
                className="font-normal text-xs"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = downloadHref;
                  link.download = "";
                  link.click();
                }}
              >
                Download
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem
              className="font-normal text-xs"
              onClick={() => onToggle(true)}
            >
              Select
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <AlertDialogTrigger
              nativeButton={false}
              render={
                <ContextMenuItem
                  variant="destructive"
                  className="font-normal text-xs"
                />
              }
            >
              Delete
            </AlertDialogTrigger>
          </ContextMenuGroup>
        </ContextMenuContent>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}
