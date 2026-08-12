import { createFileRoute } from "@tanstack/react-router";

import {
  FeedsPage,
  feedsSearchSchema,
} from "@features/feeds/components/feeds-page";

export const Route = createFileRoute("/_app/feeds/")({
  validateSearch: feedsSearchSchema,
  component: FeedsIndexRoute,
});

function FeedsIndexRoute() {
  const { item } = Route.useSearch();
  return <FeedsPage itemId={item} />;
}
