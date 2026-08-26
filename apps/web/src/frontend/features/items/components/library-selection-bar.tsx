import { Cross2Icon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { workspacesQueryOptions } from "@features/workspaces/api";

export function LibrarySelectionBar({
  count,
  busy,
  excludeWorkspaceId,
  deleteTitle,
  deleteDescription,
  onClear,
  onMove,
  onDelete,
}: {
  count: number;
  busy: boolean;
  excludeWorkspaceId?: string | null;
  deleteTitle: string;
  deleteDescription: string;
  onClear: () => void;
  onMove: (workspaceId: string) => void;
  onDelete: () => void;
}) {
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);
  const destinations = spaces.filter(
    (space) => space.id !== excludeWorkspaceId,
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex justify-center px-4 pb-3">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-border bg-background px-1 py-0.5">
        <span className="px-1.5 font-nums text-xs text-muted-foreground">
          {count}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal"
                disabled={busy || destinations.length === 0}
              />
            }
          >
            Move
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            side="top"
            className="min-w-40 shadow-none"
          >
            {destinations.map((space) => (
              <DropdownMenuItem
                key={space.id}
                className="font-normal text-xs"
                onClick={() => onMove(space.id)}
              >
                <span className="truncate">
                  {space.name.trim() || "Untitled"}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="destructive"
                size="xs"
                className="font-normal"
                disabled={busy}
              />
            }
          >
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
              >
                {busy ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear selection"
          className="text-muted-foreground"
          onClick={onClear}
        >
          <Cross2Icon />
        </Button>
      </div>
    </div>
  );
}
