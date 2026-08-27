import { createFileRoute } from "@tanstack/react-router";

import { itemsInfiniteQueryOptions } from "@features/items/api";
import {
  LibraryPage,
  librarySearchSchema,
} from "@features/items/components/library-page";

export const Route = createFileRoute("/_app/spaces/$spaceId/")({
  validateSearch: librarySearchSchema,
  loader: ({ context, params }) =>
    context.queryClient.ensureInfiniteQueryData(
      itemsInfiniteQueryOptions({ spaceId: params.spaceId }),
    ),
  component: LibraryPage,
});
