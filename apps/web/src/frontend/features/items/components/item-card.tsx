import {
  EyeOpenIcon,
  OpenInNewWindowIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { format, isValid } from "date-fns";
import { useRef, useState, type DragEvent } from "react";

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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipIconButton,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";
import { ItemMention } from "@features/items/components/item-mention";
import { ItemVideo } from "@features/items/components/item-video";
import { PdfThumb } from "@features/items/components/pdf-thumb";
import {
  isPdfFile,
  isVideoFile,
  itemFileUrl,
  itemHost,
  itemOpenHref,
  itemPreviewUrl,
} from "@features/items/lib/media";

export const ITEM_CARD_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-3";

function formatCardDate(value: string): string {
  const date = new Date(value);
  if (!isValid(date)) return "";
  const pattern =
    date.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy";
  return format(date, pattern);
}

function CardMedia({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false);
  const isImage =
    item.kind === "file" && Boolean(item.mimeType?.startsWith("image/"));
  const isSite = item.kind === "link" && Boolean(item.hasPreview);
  const src = isImage
    ? itemFileUrl(item.id)
    : isSite
      ? itemPreviewUrl(item.id)
      : null;
  const pendingLink =
    item.kind === "link" && item.parseStatus === "pending" && !item.hasPreview;
  const excerpt = item.summary?.trim() || null;
  const host = itemHost(item.url) || item.siteName?.trim() || null;

  if (isVideoFile(item)) {
    return <ItemVideo item={item} play="hover" />;
  }

  if (isPdfFile(item)) {
    return <PdfThumb fileUrl={itemFileUrl(item.id)} />;
  }

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(
          "size-full object-cover",
          isSite ? "object-top" : "object-center",
        )}
      />
    );
  }

  if (pendingLink) {
    return (
      <div className="flex size-full items-center justify-center px-3">
        <p className="text-xs text-muted-foreground">Capturing page…</p>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col justify-end gap-1 p-3">
      {host ? (
        <p className="truncate text-xs text-muted-foreground">{host}</p>
      ) : null}
      {excerpt ? (
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
          {excerpt}
        </p>
      ) : null}
    </div>
  );
}

export function ItemCard({
  item,
  selected,
  dragging,
  active,
  deleteDescription,
  onOpen,
  onToggle,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  item: Item;
  selected: boolean;
  dragging: boolean;
  active?: boolean;
  deleteDescription: string;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  const title = item.title?.trim() || "Untitled";
  const didDrag = useRef(false);
  const externalHref = itemOpenHref(item);
  const downloadHref = item.kind === "link" ? null : itemFileUrl(item.id);

  function handleOpen() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onOpen();
  }

  function openExternal() {
    if (externalHref) {
      window.open(externalHref, "_blank", "noopener,noreferrer");
    }
  }

  const actions = (
    <>
      <TooltipIconButton
        label="Preview"
        className="text-muted-foreground"
        onClick={onOpen}
      >
        <EyeOpenIcon />
      </TooltipIconButton>
      <TooltipIconButton
        label="Open in new window"
        className="text-muted-foreground"
        disabled={!externalHref}
        onClick={openExternal}
      >
        <OpenInNewWindowIcon />
      </TooltipIconButton>
      <Tooltip>
        <TooltipTrigger
          render={
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete"
                  className="text-muted-foreground hover:text-destructive active:text-destructive"
                />
              }
            />
          }
        >
          <TrashIcon />
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </>
  );

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
                "group flex cursor-grab flex-col overflow-hidden rounded-md border border-border/70 bg-background transition-colors select-none hover:border-border active:border-border active:cursor-grabbing",
                (selected || active) && "border-border bg-muted/40",
                dragging && "opacity-40",
              )}
            />
          }
        >
          <div className="relative aspect-[5/3] overflow-hidden bg-muted/40">
            <CardMedia item={item} />
            <span
              data-no-drag
              className="absolute top-2 left-2 z-10 flex items-center"
            >
              <Checkbox
                checked={selected}
                aria-label={`Select ${title}`}
                className="border-border bg-background"
                onCheckedChange={(checked) => onToggle(checked === true)}
              />
            </span>
            <span
              data-no-drag
              className="absolute top-1.5 right-1.5 z-10 flex items-center rounded-md bg-background/90 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              {actions}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
            <ItemMention item={item} className="min-w-0 flex-1" />
            <span className="shrink-0 text-xs font-nums text-muted-foreground">
              {formatCardDate(item.createdAt)}
            </span>
          </div>
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
              Open in new window
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
