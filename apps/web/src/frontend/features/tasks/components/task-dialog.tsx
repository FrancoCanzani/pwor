import { useMutation } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect, useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createTask, type Task } from "@features/tasks/api";

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onCreated,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onCreated: (task: Task) => void;
  onSave: (title: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  useEffect(() => {
    if (open) setTitle(task?.title ?? "");
  }, [open, task]);

  const create = useMutation({
    mutationFn: () => createTask(title.trim(), null, workspaceId),
    onSuccess: (created) => {
      onCreated(created);
      onOpenChange(false);
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = title.trim();
    if (!next) return;
    if (task) {
      onSave(next);
      onOpenChange(false);
    } else {
      if (create.isPending) return;
      create.mutate();
    }
  }

  function handleDelete() {
    onDelete();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs doing?"
            disabled={create.isPending}
          />
          {create.isError ? (
            <p className="text-xs text-destructive">Couldn’t add task.</p>
          ) : null}
          <DialogFooter className="-mx-0 -mb-0 flex-row justify-between border-0 bg-transparent p-0">
            {task ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!title.trim() || create.isPending}
              >
                {task ? "Save" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
