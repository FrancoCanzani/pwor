import { createFileRoute } from "@tanstack/react-router";

import { inboxItemsInfiniteQueryOptions } from "@features/items/api";
import { LibraryPage } from "@features/items/components/library-page";
import { librarySearchSchema } from "@features/items/lib/search";

export const Route = createFileRoute("/_app/inbox/")({
  validateSearch: librarySearchSchema,
  loader: ({ context }) =>
    context.queryClient.ensureInfiniteQueryData(
      inboxItemsInfiniteQueryOptions(),
    ),
  component: LibraryPage,
});
