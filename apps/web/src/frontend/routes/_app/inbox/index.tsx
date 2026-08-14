import { createFileRoute } from "@tanstack/react-router";

import {
  InboxPage,
  inboxSearchSchema,
} from "@features/inbox/components/inbox-page";

export const Route = createFileRoute("/_app/inbox/")({
  validateSearch: inboxSearchSchema,
  component: InboxPage,
});
