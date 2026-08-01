import { useMutation } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";

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

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  const create = useMutation({
    mutationFn: () => createTask(title.trim(), null, workspaceId),
    onSuccess: (task) => {
      setTitle("");
      onCreated(task);
      onOpenChange(false);
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || create.isPending) return;
    create.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTitle("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs doing?"
            className="font-normal"
            disabled={create.isPending}
          />
          {create.isError ? (
            <p className="text-xs text-destructive">Couldn’t add task.</p>
          ) : null}
          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              className="font-normal"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="font-normal"
              disabled={!title.trim() || create.isPending}
            >
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
