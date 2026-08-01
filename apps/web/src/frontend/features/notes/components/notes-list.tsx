import { useMutation } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

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
import { cn } from "@/lib/utils";
import { deleteNote, type NoteListItem } from "@features/notes/api";

function formatUpdatedAt(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function NoteRow({
  note,
  active,
  workspaceId,
  onDeleted,
}: {
  note: NoteListItem;
  active: boolean;
  workspaceId: string;
  onDeleted: (note: NoteListItem) => void;
}) {
  const deleteMutation = useMutation({
    mutationFn: () => deleteNote(note.id),
    onSuccess: () => onDeleted(note),
  });

  return (
    <li>
      <div
        className={cn(
          "group relative rounded-md px-2 py-2 transition-colors",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Link
          to="/$workspaceId/notes/$noteId"
          params={{ workspaceId, noteId: note.id }}
          className="block pr-12 no-underline"
        >
          <div className="truncate text-xs leading-none">
            {note.title?.trim() || "Untitled"}
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-[11px] leading-none text-muted-foreground">
            {formatUpdatedAt(note.updatedAt)}
          </div>
        </Link>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="absolute top-1.5 right-1 h-auto px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground opacity-100 hover:bg-transparent hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              />
            }
          >
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete note?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {note.title?.trim()
                  ? `“${note.title.trim()}” will be permanently deleted.`
                  : "This note will be permanently deleted."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  deleteMutation.mutate();
                }}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

export function NotesList({
  notes,
  selectedId,
  createPending,
  onCreate,
  onDeleted,
  className,
}: {
  notes: NoteListItem[];
  selectedId?: string;
  createPending: boolean;
  onCreate: () => void;
  onDeleted: (note: NoteListItem) => void;
  className?: string;
}) {
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col md:border-r md:border-border/40",
        className,
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
        <h1 className="text-xs leading-none font-normal text-muted-foreground">
          Notes
        </h1>
        <Button
          variant="new"
          className="h-auto px-1.5 py-1 text-xs leading-none font-normal"
          disabled={createPending}
          onClick={onCreate}
        >
          {createPending ? "…" : "New"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-2 pb-3">
        {notes.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No notes yet</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                active={note.id === selectedId}
                workspaceId={workspaceId}
                onDeleted={onDeleted}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
