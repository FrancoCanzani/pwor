import { createFileRoute, redirect } from "@tanstack/react-router";

import { LandingPage } from "@features/landing/components/landing-page";
import { sessionQueryOptions } from "@lib/session";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions,
    );
    if (session) throw redirect({ to: "/inbox" });
  },
  component: LandingPage,
});
