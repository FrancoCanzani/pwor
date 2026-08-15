import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { NotFound } from "@components/not-found";
import { RouteError } from "@components/route-error";
import { ItemDropZone } from "@features/items/components/item-drop-zone";
import { workspacesQueryOptions } from "@features/workspaces/api";
import { sessionQueryOptions } from "@lib/session";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) throw redirect({ to: "/login" });

    const workspaces = await context.queryClient.ensureQueryData(
      workspacesQueryOptions,
    );

    const incomplete = workspaces.length === 0;
    const onOnboarding = location.pathname === "/onboarding";

    if (incomplete && !onOnboarding) {
      throw redirect({ to: "/onboarding" });
    }

    if (!incomplete && onOnboarding) {
      throw redirect({ to: "/" });
    }

    return {
      user: {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      },
    };
  },
  shouldReload: false,
  errorComponent: RouteError,
  notFoundComponent: NotFound,
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname === "/onboarding") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <ItemDropZone />
      <Toaster />
      <Outlet />
    </AppShell>
  );
}
