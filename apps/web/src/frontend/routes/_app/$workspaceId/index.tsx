import { createFileRoute } from "@tanstack/react-router";

import { PacksPage } from "@features/packs/components/packs-page";

export const Route = createFileRoute("/_app/$workspaceId/")({
  component: WorkspacePacksRoute,
});

function WorkspacePacksRoute() {
  return <PacksPage />;
}
