import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@lib/auth-client";

const loginSearchSchema = z.object({
  callbackURL: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { callbackURL } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const { error: signInError } = await authClient.signIn.magicLink({
        email,
        callbackURL: callbackURL || "/",
      });

      if (signInError) {
        setError(signInError.message ?? "Something went wrong.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-6">
      <div className="w-full max-w-[280px]">
        <h1 className="mb-1.5 text-lg font-normal tracking-tight leading-tight">
          Odiseum
        </h1>
        <p className="mb-5 text-xs leading-normal text-muted-foreground">
          Your life, organized itself.
        </p>

        {sent ? (
          <p className="m-0 text-xs leading-normal text-foreground">
            Check your email for a link sent to{" "}
            <span className="text-muted-foreground">{email}</span>.
          </p>
        ) : (
          <form className="flex flex-col gap-2.5" onSubmit={handleSubmit}>
            <label
              className="text-xs font-normal text-muted-foreground"
              htmlFor="email"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className="h-8 font-normal"
            />
            {error ? (
              <p className="m-0 text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="w-full font-normal"
              disabled={pending}
            >
              {pending ? "Sending…" : "Continue"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
