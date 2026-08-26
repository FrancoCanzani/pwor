import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { itemsInfiniteQueryOptions } from "@features/items/api";
import { SpaceLibraryPage } from "@features/spaces/components/space-library-page";

const spaceSearchSchema = z.object({
  item: z.string().optional(),
});

export const Route = createFileRoute("/_app/spaces/$spaceId/")({
  validateSearch: spaceSearchSchema,
  loader: ({ context, params }) =>
    context.queryClient.ensureInfiniteQueryData(
      itemsInfiniteQueryOptions(params.spaceId),
    ),
  component: SpaceLibraryPage,
});
