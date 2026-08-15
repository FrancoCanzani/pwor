import { createFileRoute } from "@tanstack/react-router";

import { feedItemsQueryOptions, feedsQueryOptions } from "@features/feeds/api";
import {
  FeedsPage,
  feedsSearchSchema,
} from "@features/feeds/components/feeds-page";

export const Route = createFileRoute("/_app/feeds/$feedId/")({
  validateSearch: feedsSearchSchema,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(feedsQueryOptions()),
      context.queryClient.ensureQueryData(
        feedItemsQueryOptions({ feedId: params.feedId }),
      ),
    ]),
  component: FeedsPage,
});
