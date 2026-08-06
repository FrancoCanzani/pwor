import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PackDetailPage } from "@features/packs/components/pack-detail-page";

const searchSchema = z.object({
  source: z.string().optional(),
});

export const Route = createFileRoute("/_app/$workspaceId/packs/$packId/")({
  validateSearch: searchSchema,
  component: PackDetailRoute,
});

function PackDetailRoute() {
  const { workspaceId, packId } = Route.useParams();
  const { source } = Route.useSearch();
  return (
    <PackDetailPage
      workspaceId={workspaceId}
      packId={packId}
      selectedSourceId={source ?? null}
    />
  );
}
