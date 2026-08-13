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
import { SpaceShaderPicker } from "@features/spaces/components/space-shader-picker";
import {
  DEFAULT_SPACE_SHADER,
  type SpaceShaderId,
} from "@features/spaces/lib/space-shaders";
import { createWorkspace, type Workspace } from "@features/workspaces/api";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: Workspace) => void;
}) {
  const [name, setName] = useState("");
  const [shader, setShader] = useState<SpaceShaderId>(DEFAULT_SPACE_SHADER);

  const create = useMutation({
    mutationFn: () => createWorkspace(name.trim(), { shader }),
    onSuccess: (workspace) => {
      setName("");
      setShader(DEFAULT_SPACE_SHADER);
      onCreated(workspace);
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
        if (!next) {
          setName("");
          setShader(DEFAULT_SPACE_SHADER);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>New space</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Work, Life, Freelance…"
            disabled={create.isPending}
          />
          <SpaceShaderPicker value={shader} onChange={setShader} />
          {create.isError ? (
            <p className="text-xs text-destructive">
              Couldn’t create space.
            </p>
          ) : null}
          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || create.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
