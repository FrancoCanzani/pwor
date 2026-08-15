import { createFileRoute } from "@tanstack/react-router";

import { feedItemsQueryOptions, feedsQueryOptions } from "@features/feeds/api";
import {
  FeedsPage,
  feedsSearchSchema,
} from "@features/feeds/components/feeds-page";

export const Route = createFileRoute("/_app/feeds/")({
  validateSearch: feedsSearchSchema,
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(feedsQueryOptions()),
      context.queryClient.ensureQueryData(feedItemsQueryOptions()),
    ]),
  component: FeedsPage,
});
