import { createFileRoute } from "@tanstack/react-router";

import {
  FeedsPage,
  feedsSearchSchema,
} from "@features/feeds/components/feeds-page";

export const Route = createFileRoute("/_app/feeds/$feedId/")({
  validateSearch: feedsSearchSchema,
  component: FeedsPage,
});
