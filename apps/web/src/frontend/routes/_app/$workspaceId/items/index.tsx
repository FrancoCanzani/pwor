import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  itemsInfiniteQueryOptions,
  itemUsageQueryOptions,
} from "@features/items/api";
import { ItemPage } from "@features/items/components/item-page";

const itemSearchSchema = z.object({
  item: z.string().optional(),
});

export const Route = createFileRoute("/_app/$workspaceId/items/")({
  validateSearch: itemSearchSchema,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureInfiniteQueryData(
        itemsInfiniteQueryOptions(params.workspaceId),
      ),
      context.queryClient.ensureQueryData(
        itemUsageQueryOptions(params.workspaceId),
      ),
    ]),
  component: ItemPage,
});
