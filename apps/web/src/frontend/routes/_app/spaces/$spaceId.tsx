import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { spacesQueryOptions } from "@features/spaces/api";
import {
  getStoredSpaceId,
  setStoredSpaceId,
} from "@features/spaces/lib/current-space";

export const Route = createFileRoute("/_app/spaces/$spaceId")({
  beforeLoad: async ({ context, params }) => {
    const spaces = await context.queryClient.ensureQueryData(
      spacesQueryOptions,
    );
    const valid = spaces.some((s) => s.id === params.spaceId);

    if (!valid) {
      const storedId = getStoredSpaceId();
      const fallbackId = spaces.some((s) => s.id === storedId)
        ? storedId!
        : spaces[0]!.id;
      throw redirect({
        to: "/spaces/$spaceId",
        params: { spaceId: fallbackId },
        replace: true,
      });
    }

    setStoredSpaceId(params.spaceId);
  },
  component: () => <Outlet />,
});
