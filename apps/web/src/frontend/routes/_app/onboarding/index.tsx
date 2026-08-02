import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type SubmitEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createWorkspace,
  createWorkspaceInbox,
  workspacesQueryOptions,
} from "@features/workspaces/api";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";
import { authClient } from "@lib/auth-client";
import { fileToAvatarDataUrl } from "@lib/avatar";
import { cue } from "@lib/sound";
import { refreshSession, sessionQueryOptions } from "@lib/session";

const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .refine((value) => value.includes(" "), {
      message: "Enter your first and last name.",
    }),
});

export const Route = createFileRoute("/_app/onboarding/")({
  component: OnboardingPage,
});

function WorkspaceStep() {
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
      const workspace = await createWorkspace(trimmed);
      setStoredWorkspaceId(workspace.id);
      try {
        await createWorkspaceInbox(workspace.id);
      } catch {
        // Best-effort — the workspace exists either way; an inbox
        // address can be added later from workspace settings.
      }
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
        <Label
          htmlFor="workspace-name"
          className="text-xs text-muted-foreground"
        >
          Workspace name
        </Label>
        <Input
          id="workspace-name"
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
        data-cuelume-press
      >
        {isSubmitting ? "Creating…" : "Continue"}
      </Button>
    </form>
  );
}

function OnboardingPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workspaces } = useQuery(workspacesQueryOptions);
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step, setStep] = useState<"profile" | "workspace">(
    user.name.trim() ? "workspace" : "profile",
  );

  const form = useForm({
    defaultValues: {
      name: user.name.trim() || "",
    },
    validators: {
      onSubmit: onboardingSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      setAvatarError(null);

      try {
        const name = value.name.trim();
        const { error } = await authClient.updateUser({
          name,
          ...(avatar ? { image: avatar } : {}),
        });

        if (error) {
          setSubmitError(error.message ?? "Something went wrong.");
          return;
        }

        const session = await refreshSession(queryClient);
        if (!session) {
          setSubmitError("Session expired. Sign in again.");
          return;
        }

        // Ensure the gate sees the name we just saved, even if the session
        // cookie/cache briefly lags behind the DB write.
        queryClient.setQueryData(sessionQueryOptions.queryKey, (current) => {
          const base = current ?? session;
          return {
            ...base,
            user: {
              ...base.user,
              name,
              image: avatar ?? base.user.image,
            },
          };
        });

        cue("success");
        if ((workspaces?.length ?? 0) > 0) {
          await navigate({ to: "/" });
        } else {
          setStep("workspace");
        }
      } catch {
        setSubmitError("Something went wrong.");
      }
    },
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setAvatarError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatar(dataUrl);
    } catch (error) {
      setAvatar(null);
      setAvatarError(
        error instanceof Error ? error.message : "Could not read image.",
      );
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-6">
      <div className="w-full max-w-[320px]">
        <h1 className="mb-1.5 font-pixel text-lg font-normal tracking-tight leading-tight">
          Odiseum
        </h1>
        <p className="mb-6 text-xs leading-normal text-muted-foreground">
          {step === "profile"
            ? "Tell us your name. Avatar is optional."
            : "Give your first workspace a name — Work, Life, whatever fits."}
        </p>

        {step === "workspace" ? (
          <WorkspaceStep />
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">
                Avatar{" "}
                <span className="text-muted-foreground/70">(optional)</span>
              </Label>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void handleFile(event.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-transparent text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground",
                  dragging && "border-ring text-foreground",
                  avatarError && "border-destructive",
                )}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Avatar preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <span>Drop an image, or click to choose</span>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void handleFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {avatarError ? (
                <p className="m-0 text-xs text-destructive" role="alert">
                  {avatarError}
                </p>
              ) : null}
            </div>

            <form.Field name="name">
              {(field) => {
                const error = field.state.meta.errors[0];
                const message =
                  typeof error === "string"
                    ? error
                    : error &&
                        typeof error === "object" &&
                        "message" in error &&
                        typeof error.message === "string"
                      ? error.message
                      : null;

                return (
                  <div className="flex flex-col gap-2">
                    <Label
                      htmlFor={field.name}
                      className="text-xs text-muted-foreground"
                    >
                      Full name
                    </Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      autoComplete="name"
                      autoFocus
                      placeholder="Jane Doe"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      className="h-8 font-normal"
                      aria-invalid={Boolean(message)}
                    />
                    {message ? (
                      <p className="m-0 text-xs text-destructive" role="alert">
                        {message}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            </form.Field>

            {submitError ? (
              <p className="m-0 text-xs text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  className="w-full font-normal"
                  disabled={isSubmitting}
                  data-cuelume-press
                >
                  {isSubmitting ? "Saving…" : "Continue"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        )}
      </div>
    </main>
  );
}
