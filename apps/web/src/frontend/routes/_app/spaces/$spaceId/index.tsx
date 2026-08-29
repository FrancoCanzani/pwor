import { createFileRoute } from "@tanstack/react-router";

import { itemsInfiniteQueryOptions } from "@features/items/api";
import { LibraryPage } from "@features/items/components/library-page";
import { librarySearchSchema } from "@features/items/lib/search";

export const Route = createFileRoute("/_app/spaces/$spaceId/")({
  validateSearch: librarySearchSchema,
  loader: ({ context, params }) =>
    context.queryClient.ensureInfiniteQueryData(
      itemsInfiniteQueryOptions({ spaceId: params.spaceId }),
    ),
  component: LibraryPage,
});
