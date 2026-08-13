import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpaceShaderPicker } from "@features/spaces/components/space-shader-picker";
import {
  DEFAULT_SPACE_SHADER,
  type SpaceShaderId,
} from "@features/spaces/lib/space-shaders";
import {
  createWorkspace,
  workspacesQueryOptions,
} from "@features/workspaces/api";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";
import { cue } from "@lib/sound";

export function WorkspaceStep() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [shader, setShader] = useState<SpaceShaderId>(DEFAULT_SPACE_SHADER);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const workspace = await createWorkspace(trimmed, { shader });
      setStoredWorkspaceId(workspace.id);
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryOptions.queryKey,
        exact: true,
      });
      cue("success");
      await navigate({ to: "/" });
    } catch {
      setError("Something went wrong.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="space-name" className="text-xs text-muted-foreground">
          Space name
        </Label>
        <Input
          id="space-name"
          autoFocus
          autoComplete="off"
          placeholder="Work, Life, Freelance…"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <SpaceShaderPicker value={shader} onChange={setShader} />

      {error ? (
        <p className="m-0 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full font-normal"
        disabled={!name.trim() || isSubmitting}
        data-cuelume-press
      >
        {isSubmitting ? "Creating…" : "Continue"}
      </Button>
    </form>
  );
}
