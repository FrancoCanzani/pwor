import { DrawingPinFilledIcon } from "@radix-ui/react-icons";
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
import { noteDisplayTitle } from "@shared/note-frontmatter";
import type { LibraryItemHandlers } from "@features/items/components/library-row";
import { formatItemDate } from "@features/items/lib/list";
import type { NoteListItem } from "@features/notes/api";

export function NoteMenus({
  title,
  pinned,
  deleteDescription,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  children,
}: {
  title: string;
  pinned: boolean;
  deleteDescription: string;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onPin: () => void;
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
            <ContextMenuItem className="font-normal text-xs" onClick={onPin}>
              {pinned ? "Unpin" : "Pin"}
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

export function NoteRow({
  note,
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
  note: NoteListItem;
  deleteDescription: string;
  edgeToEdge?: boolean;
  first?: boolean;
  last?: boolean;
} & LibraryItemHandlers) {
  const title = noteDisplayTitle(note.title);
  const preview = note.bodyPreview?.trim() || null;
  const { handleOpen, markDrag } = useNoteOpen(onOpen);

  return (
    <NoteMenus
      title={title}
      pinned={Boolean(note.pinned)}
      deleteDescription={deleteDescription}
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
              "group flex w-full cursor-grab items-center gap-2 py-2 select-none hover:bg-muted/40 active:cursor-grabbing",
              edgeToEdge ? "px-3" : "px-4",
              first && "rounded-t-lg",
              last && "rounded-b-lg",
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
        <span className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
          <span className="max-w-[40%] shrink-0 truncate text-sm">{title}</span>
          {preview ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {preview}
            </span>
          ) : null}
        </span>
        {note.pinned ? (
          <DrawingPinFilledIcon className="size-3 shrink-0 text-muted-foreground" />
        ) : null}
        <span className="shrink-0 text-xs font-nums text-muted-foreground">
          {formatItemDate(note.updatedAt)}
        </span>
      </ContextMenuTrigger>
    </NoteMenus>
  );
}
