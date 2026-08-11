import { createFileRoute } from "@tanstack/react-router";

import { SpaceLibraryPage } from "@features/spaces/components/space-library-page";

export const Route = createFileRoute("/_app/$workspaceId/")({
  component: SpaceLibraryRoute,
});

function SpaceLibraryRoute() {
  return <SpaceLibraryPage />;
}
