import { createFileRoute } from "@tanstack/react-router";

import { PackDetailPage } from "@features/packs/components/pack-detail-page";

export const Route = createFileRoute("/_app/$workspaceId/packs/$packId/")({
  component: PackDetailRoute,
});

function PackDetailRoute() {
  const { workspaceId, packId } = Route.useParams();
  return <PackDetailPage workspaceId={workspaceId} packId={packId} />;
}
