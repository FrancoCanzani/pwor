import { TrashIcon } from "@radix-ui/react-icons";
import { useRef, type ReactNode } from "react";

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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { noteDisplayTitle } from "@shared/note-frontmatter";
import type { LibraryItemHandlers } from "@features/items/components/library-row";
import { formatCardDate, formatItemDate } from "@features/items/lib/list";
import type { NoteListItem } from "@features/notes/api";

function NoteActions({
  title,
}: {
  title: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${title}`}
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
  );
}

function NoteMenus({
  title,
  deleteDescription,
  onOpen,
  onToggle,
  onDelete,
  children,
}: {
  title: string;
  deleteDescription: string;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <AlertDialog>
        {children}
        <ContextMenuContent className="shadow-none">
          <ContextMenuGroup>
            <ContextMenuItem className="font-normal text-xs" onClick={onOpen}>
              Open
            </ContextMenuItem>
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

function useNoteOpen(onOpen: () => void) {
  const didDrag = useRef(false);

  function handleOpen() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onOpen();
  }

  function markDrag() {
    didDrag.current = true;
  }

  return { handleOpen, markDrag };
}

export function NoteCard({
  note,
  selected,
  dragging,
  active,
  deleteDescription,
  onOpen,
  onToggle,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  note: NoteListItem;
  deleteDescription: string;
} & LibraryItemHandlers) {
  const title = noteDisplayTitle(note.title);
  const preview = note.bodyPreview?.trim() || null;
  const { handleOpen, markDrag } = useNoteOpen(onOpen);

  return (
    <NoteMenus
      title={title}
      deleteDescription={deleteDescription}
      onOpen={onOpen}
      onToggle={onToggle}
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
              markDrag();
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
        <div className="relative flex aspect-[5/3] flex-col overflow-hidden bg-muted/40">
          <div
            data-no-drag
            className="flex shrink-0 items-center gap-1 px-2 pt-2"
          >
            <Checkbox
              checked={selected}
              aria-label={`Select ${title}`}
              className="border-border bg-background"
              onCheckedChange={(checked) => onToggle(checked === true)}
            />
            <span className="ml-auto flex items-center rounded-md bg-background/90 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              <NoteActions title={title} />
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 pt-1.5 pb-3">
            <p className="line-clamp-2 text-sm leading-snug">{title}</p>
            {preview ? (
              <p className="line-clamp-6 text-xs leading-relaxed text-muted-foreground">
                {preview}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Note</span>
          <span className="ml-auto shrink-0 font-nums text-xs text-muted-foreground">
            {formatCardDate(note.updatedAt)}
          </span>
        </div>
      </ContextMenuTrigger>
    </NoteMenus>
  );
}

export function NoteRow({
  note,
  selected,
  dragging,
  active,
  deleteDescription,
  onOpen,
  onToggle,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  note: NoteListItem;
  deleteDescription: string;
} & LibraryItemHandlers) {
  const title = noteDisplayTitle(note.title);
  const preview = note.bodyPreview?.trim() || null;
  const { handleOpen, markDrag } = useNoteOpen(onOpen);

  return (
    <NoteMenus
      title={title}
      deleteDescription={deleteDescription}
      onOpen={onOpen}
      onToggle={onToggle}
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
              markDrag();
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
              "group flex w-full cursor-grab items-center gap-2 px-4 py-2 select-none hover:bg-muted/40 active:cursor-grabbing",
              active && "bg-muted/50",
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
        <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
        {preview ? (
          <span className="hidden min-w-0 max-w-[40%] truncate text-xs text-muted-foreground sm:block">
            {preview}
          </span>
        ) : null}
        <span
          data-no-drag
          className="flex shrink-0 items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        >
          <NoteActions title={title} />
        </span>
        <span className="shrink-0 text-xs font-nums text-muted-foreground">
          {formatItemDate(note.updatedAt)}
        </span>
      </ContextMenuTrigger>
    </NoteMenus>
  );
}
