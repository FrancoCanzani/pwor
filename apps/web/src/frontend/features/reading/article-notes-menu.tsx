import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  noteHasAnchor,
  passageIsNoted,
  type NoteListItem,
} from "@features/notes/api";

export function ArticleNotesMenu({
  notes,
  onSelect,
  className,
}: {
  notes: NoteListItem[];
  onSelect: (note: NoteListItem) => void;
  className?: string;
}) {
  const noted = notes.filter(
    (note) => passageIsNoted(note) && noteHasAnchor(note),
  );
  if (noted.length === 0) return null;

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="font-normal text-muted-foreground"
            />
          }
        >
          Notes (<span className="font-nums">{noted.length}</span>)
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 max-w-72">
          <DropdownMenuGroup>
            {noted.map((note) => (
              <DropdownMenuItem
                key={note.id}
                className="font-normal text-xs"
                onClick={() => onSelect(note)}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="line-clamp-1">
                    {note.anchorQuote?.replace(/\s+/g, " ").trim() ||
                      note.title ||
                      "Note"}
                  </span>
                  {note.bodyPreview ? (
                    <span className="line-clamp-1 text-muted-foreground">
                      {note.bodyPreview}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
