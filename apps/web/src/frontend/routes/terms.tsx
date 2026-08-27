import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "@features/legal/components/terms-page";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});
