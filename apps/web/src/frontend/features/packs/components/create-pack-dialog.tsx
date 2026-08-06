import { useMutation } from "@tanstack/react-query";
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
import { createPack, type Pack } from "@features/packs/api";

export function CreatePackDialog({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreated: (pack: Pack) => void;
}) {
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createPack({ name: name.trim(), workspaceId }),
    onSuccess: (pack) => {
      setName("");
      onCreated(pack);
      onOpenChange(false);
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || create.isPending) return;
    create.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName("");
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>New pack</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Research, Design System…"
            disabled={create.isPending}
          />
          {create.isError ? (
            <p className="text-xs text-destructive">Couldn’t create pack.</p>
          ) : null}
          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
