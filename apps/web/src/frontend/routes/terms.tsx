import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "@features/legal/components/terms-page";
import { sessionQueryOptions } from "@lib/session";

export const Route = createFileRoute("/terms")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(sessionQueryOptions),
  component: TermsPage,
});
