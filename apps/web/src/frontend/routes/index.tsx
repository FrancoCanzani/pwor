import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@features/landing/components/landing-page";
import { sessionQueryOptions } from "@lib/session";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(sessionQueryOptions),
  component: LandingPage,
});
