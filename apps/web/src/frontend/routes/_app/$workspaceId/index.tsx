import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceDetail } from "@features/workspaces/components/workspace-detail";

export const Route = createFileRoute("/_app/$workspaceId/")({
  component: WorkspaceDetailRoute,
});

function WorkspaceDetailRoute() {
  const { workspaceId } = Route.useParams();
  return <WorkspaceDetail workspaceId={workspaceId} />;
}
