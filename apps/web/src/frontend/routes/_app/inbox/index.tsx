import { createFileRoute } from "@tanstack/react-router";

import {
  InboxPage,
  inboxSearchSchema,
} from "@features/inbox/components/inbox-page";
import { inboxItemsInfiniteQueryOptions } from "@features/items/api";

export const Route = createFileRoute("/_app/inbox/")({
  validateSearch: inboxSearchSchema,
  loader: ({ context }) =>
    context.queryClient.ensureInfiniteQueryData(
      inboxItemsInfiniteQueryOptions(),
    ),
  component: InboxPage,
});
