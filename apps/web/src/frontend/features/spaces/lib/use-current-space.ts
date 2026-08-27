import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { spacesQueryOptions } from "@features/spaces/api";
import { getStoredSpaceId } from "@features/spaces/lib/current-space";

export function useCurrentSpace() {
  const { data: spaces = [] } = useQuery(spacesQueryOptions);
  const { spaceId: routeId } = useParams({ strict: false });
  const storedId = getStoredSpaceId();

  const id =
    routeId ??
    (spaces.some((s) => s.id === storedId) ? storedId! : spaces[0]?.id);
  const name = spaces.find((s) => s.id === id)?.name.trim();

  return { id, name };
}
