import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { workspacesQueryOptions } from "@features/workspaces/api";
import {
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "@features/workspaces/lib/current-workspace";

export const Route = createFileRoute("/_app/$workspaceId")({
  beforeLoad: async ({ context, params }) => {
    const workspaces = await context.queryClient.ensureQueryData(
      workspacesQueryOptions,
    );
    const valid = workspaces.some((w) => w.id === params.workspaceId);

    if (!valid) {
      const storedId = getStoredWorkspaceId();
      const fallbackId = workspaces.some((w) => w.id === storedId)
        ? storedId!
        : workspaces[0]!.id;
      throw redirect({
        to: ".",
        params: (prev) => ({ ...prev, workspaceId: fallbackId }),
        replace: true,
      });
    }

    setStoredWorkspaceId(params.workspaceId);
  },
  component: () => <Outlet />,
});
