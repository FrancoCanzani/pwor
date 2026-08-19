import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { itemsInfiniteQueryOptions } from "@features/items/api";
import { notesQueryOptions } from "@features/notes/api";
import { SpaceLibraryPage } from "@features/spaces/components/space-library-page";

const spaceSearchSchema = z.object({
  item: z.string().optional(),
});

export const Route = createFileRoute("/_app/$workspaceId/")({
  validateSearch: spaceSearchSchema,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureInfiniteQueryData(
        itemsInfiniteQueryOptions(params.workspaceId),
      ),
      context.queryClient.ensureQueryData(
        notesQueryOptions(params.workspaceId),
      ),
    ]),
  component: SpaceLibraryPage,
});
