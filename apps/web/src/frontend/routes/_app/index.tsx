import { createFileRoute, redirect } from "@tanstack/react-router";

import { workspacesQueryOptions } from "@features/workspaces/api";
import { getStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";

export const Route = createFileRoute("/_app/")({
  beforeLoad: async ({ context }) => {
    const workspaces = await context.queryClient.ensureQueryData(
      workspacesQueryOptions,
    );
    const storedId = getStoredWorkspaceId();
    const workspaceId = workspaces.some((w) => w.id === storedId)
      ? storedId!
      : workspaces[0]!.id;

    throw redirect({
      to: "/$workspaceId",
      params: { workspaceId },
    });
  },
});
