import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { workspacesQueryOptions } from "@features/workspaces/api";
import { getStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";

export function useCurrentWorkspace() {
  const { data: workspaces = [] } = useQuery(workspacesQueryOptions);
  const { spaceId: routeId } = useParams({ strict: false });
  const storedId = getStoredWorkspaceId();

  const id =
    routeId ??
    (workspaces.some((w) => w.id === storedId) ? storedId! : workspaces[0]?.id);
  const name = workspaces.find((w) => w.id === id)?.name.trim();

  return { id, name };
}
