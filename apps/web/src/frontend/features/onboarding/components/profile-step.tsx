import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { authClient } from "@lib/auth-client";
import { fileToAvatarDataUrl } from "@lib/avatar";
import { refreshSession, sessionQueryOptions } from "@lib/session";
import { cue } from "@lib/sound";

const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .refine((value) => value.includes(" "), {
      message: "Enter your first and last name.",
    }),
});

export function ProfileStep({
  defaultName,
  onDone,
}: {
  defaultName: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: defaultName,
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
        onDone();
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
          Avatar <span className="text-muted-foreground/70">(optional)</span>
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
                onChange={(event) => field.handleChange(event.target.value)}
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
  );
}
