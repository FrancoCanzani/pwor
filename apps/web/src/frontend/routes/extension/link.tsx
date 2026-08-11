import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@lib/session";

const searchSchema = z.object({
  pairing: z.string().min(1),
});

export const Route = createFileRoute("/extension/link")({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, location }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) {
      throw redirect({
        to: "/login",
        search: {
          callbackURL: `${location.pathname}${location.searchStr}`,
        },
      });
    }
    return { email: session.user.email };
  },
  component: ExtensionLinkPage,
});

async function approvePairing(pairingId: string) {
  const response = await fetch("/api/extension/link/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingId, name: "Browser" }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Could not link extension");
  }
}

function ExtensionLinkPage() {
  const { pairing } = Route.useSearch();
  const { email } = Route.useRouteContext();
  const [done, setDone] = useState(false);

  const approve = useMutation({
    mutationFn: () => approvePairing(pairing),
    onSuccess: () => setDone(true),
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-6">
      <div className="w-full max-w-70">
        <h1 className="mb-1.5 font-pixel text-lg font-normal tracking-tight leading-tight">
          Pwor
        </h1>
        <p className="mb-6 text-xs text-muted-foreground">
          Link the browser extension to {email}.
        </p>

        {done ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs">Extension linked. You can close this tab.</p>
            <Button
              type="button"
              variant="outline"
              className="w-full font-normal"
              onClick={() => window.close()}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Allow this browser to save pages and tweets into your spaces.
            </p>
            {approve.error ? (
              <p className="text-xs text-destructive">
                {approve.error instanceof Error
                  ? approve.error.message
                  : "Something went wrong."}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full font-normal"
              disabled={approve.isPending}
              onClick={() => approve.mutate()}
            >
              {approve.isPending ? "Linking…" : "Link extension"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
