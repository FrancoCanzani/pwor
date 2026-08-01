import { TrashIcon } from "@radix-ui/react-icons";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@features/tasks/api";

export function TaskDeleteButton({
  task,
  onDelete,
  className,
}: {
  task: Task;
  onDelete: (task: Task) => void;
  className?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn("text-muted-foreground", className)}
        aria-label="Delete task"
        onClick={(event) => {
          event.stopPropagation();
          setConfirmOpen(true);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <TrashIcon />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{task.title}” will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-normal">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="font-normal"
              onClick={() => onDelete(task)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
