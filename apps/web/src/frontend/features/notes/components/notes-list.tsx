import { UpdateIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NoteListItem } from "@features/notes/api";

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

export function NotesList({
  notes,
  selectedId,
  isLoading,
  createPending,
  onCreate,
  onDelete,
  className,
}: {
  notes: NoteListItem[];
  selectedId?: string;
  isLoading: boolean;
  createPending: boolean;
  onCreate: () => void;
  onDelete: (note: NoteListItem) => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col md:border-r md:border-border/40",
        className,
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
        <h1 className="text-xs leading-none font-normal text-muted-foreground">
          Notes
        </h1>
        <Button
          size="sm"
          variant="ghost"
          className="h-auto px-1.5 py-1 text-xs leading-none font-normal"
          disabled={createPending}
          onClick={onCreate}
        >
          {createPending ? "…" : "New"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-2 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <UpdateIcon className="size-[15px] animate-spin" />
            <span className="sr-only">Loading</span>
          </div>
        ) : notes.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No notes yet</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {notes.map((note) => {
              const active = note.id === selectedId;
              return (
                <li key={note.id}>
                  <div
                    className={cn(
                      "group relative rounded-none px-2 py-2 transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Link
                      to="/notes/$noteId"
                      params={{ noteId: note.id }}
                      className="block pr-12 no-underline"
                    >
                      <div className="truncate text-xs leading-none">
                        {note.title?.trim() || "Untitled"}
                      </div>
                      <div className="mt-1.5 font-mono tabular-nums text-[11px] leading-none text-muted-foreground">
                        {formatUpdatedAt(note.updatedAt)}
                      </div>
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="absolute top-1.5 right-1 h-auto px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground opacity-100 hover:bg-transparent hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      onClick={() => onDelete(note)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
