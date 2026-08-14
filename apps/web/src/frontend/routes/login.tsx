import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@lib/auth-client";
import { cue } from "@lib/sound";

const loginSearchSchema = z.object({
  callbackURL: z.string().optional(),
});

const loginFormSchema = z.object({
  email: z.email("Enter a valid email."),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function fieldErrorMessage(errors: unknown[]) {
  return errors
    .map((error) => {
      if (typeof error === "string") return error;
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        return error.message;
      }
      return null;
    })
    .filter(Boolean)
    .join(", ");
}

function LoginPage() {
  const { callbackURL } = Route.useSearch();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: loginFormSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        const { error: signInError } = await authClient.signIn.magicLink({
          email: value.email,
          callbackURL: callbackURL || "/",
        });

        if (signInError) {
          setSubmitError(signInError.message ?? "Something went wrong.");
          return;
        }

        cue("success");
        setSentTo(value.email);
      } catch {
        setSubmitError("Something went wrong.");
      }
    },
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
      <div className="w-full max-w-70">
        <h1 className="mb-1.5 font-pixel text-lg font-normal tracking-tight leading-tight">
          Pwor
        </h1>
        <p className="mb-5 text-xs leading-normal text-muted-foreground">
          Your life, organized itself.
        </p>

        {sentTo ? (
          <p className="m-0 text-xs leading-normal text-foreground">
            Check your email for a link sent to{" "}
            <span className="text-muted-foreground">{sentTo}</span>.
          </p>
        ) : (
          <form
            className="flex flex-col gap-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field name="email">
              {(field) => {
                const errorMessage = fieldErrorMessage(field.state.meta.errors);

                return (
                  <>
                    <Label
                      htmlFor={field.name}
                      className="text-xs text-muted-foreground"
                    >
                      Email
                    </Label>
                    <Input
                      id={field.name}
                      type="email"
                      name={field.name}
                      autoComplete="email"
                      autoFocus
                      placeholder="you@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      className="h-8 font-normal"
                    />
                    {errorMessage ? (
                      <p className="m-0 text-xs text-destructive" role="alert">
                        {errorMessage}
                      </p>
                    ) : null}
                  </>
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
                  disabled={isSubmitting}
                  data-cuelume-press
                >
                  {isSubmitting ? "Sending…" : "Continue"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        )}
      </div>
    </main>
  );
}
