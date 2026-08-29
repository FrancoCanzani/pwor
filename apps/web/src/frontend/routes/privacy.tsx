import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "@features/legal/components/privacy-page";
import { sessionQueryOptions } from "@lib/session";

export const Route = createFileRoute("/privacy")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(sessionQueryOptions),
  component: PrivacyPage,
});
