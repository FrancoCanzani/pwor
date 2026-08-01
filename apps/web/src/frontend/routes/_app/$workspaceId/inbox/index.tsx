import { createFileRoute } from "@tanstack/react-router";

import { InboxPage } from "@features/inbox/components/inbox-page";

export const Route = createFileRoute("/_app/$workspaceId/inbox/")({
  component: InboxPage,
});
