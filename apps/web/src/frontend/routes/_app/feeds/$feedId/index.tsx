import { createFileRoute } from "@tanstack/react-router";

import {
  FeedsPage,
  feedsSearchSchema,
} from "@features/feeds/components/feeds-page";

export const Route = createFileRoute("/_app/feeds/$feedId/")({
  validateSearch: feedsSearchSchema,
  component: FeedDetailRoute,
});

function FeedDetailRoute() {
  const { feedId } = Route.useParams();
  const { item } = Route.useSearch();
  return <FeedsPage feedId={feedId} itemId={item} />;
}
