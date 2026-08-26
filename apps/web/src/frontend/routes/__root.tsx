import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { NotFound } from "@components/not-found";
import { RouteError } from "@components/route-error";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootLayout,
    errorComponent: RouteError,
    notFoundComponent: NotFound,
  },
);

function RootLayout() {
  return <Outlet />;
}
