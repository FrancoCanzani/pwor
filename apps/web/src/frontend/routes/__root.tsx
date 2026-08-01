import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { NotFound } from "@components/not-found";
import { RouteError } from "@components/route-error";
import { startSound } from "@lib/sound";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootLayout,
    errorComponent: RouteError,
    notFoundComponent: NotFound,
  },
);

function RootLayout() {
  useEffect(() => {
    startSound();
  }, []);

  return <Outlet />;
}
