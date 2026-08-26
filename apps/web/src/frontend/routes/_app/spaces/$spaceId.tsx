import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { workspacesQueryOptions } from "@features/workspaces/api";
import {
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "@features/workspaces/lib/current-workspace";

export const Route = createFileRoute("/_app/spaces/$spaceId")({
  beforeLoad: async ({ context, params }) => {
    const workspaces = await context.queryClient.ensureQueryData(
      workspacesQueryOptions,
    );
    const valid = workspaces.some((w) => w.id === params.spaceId);

    if (!valid) {
      const storedId = getStoredWorkspaceId();
      const fallbackId = workspaces.some((w) => w.id === storedId)
        ? storedId!
        : workspaces[0]!.id;
      throw redirect({
        to: "/spaces/$spaceId",
        params: { spaceId: fallbackId },
        replace: true,
      });
    }

    setStoredWorkspaceId(params.spaceId);
  },
  component: () => <Outlet />,
});
