import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSpace,
  spacesQueryOptions,
} from "@features/spaces/api";
import { setStoredSpaceId } from "@features/spaces/lib/current-space";

export function SpaceStep() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createSpace(trimmed);
      setStoredSpaceId(created.id);
      await queryClient.invalidateQueries({
        queryKey: spacesQueryOptions.queryKey,
        exact: true,
      });
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

      {error ? (
        <p className="m-0 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full font-normal"
        disabled={!name.trim() || isSubmitting}
      >
        {isSubmitting ? "Creating…" : "Continue"}
      </Button>
    </form>
  );
}
