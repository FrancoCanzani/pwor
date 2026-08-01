import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";
import { Loading } from "@components/loading";
import { NotFound } from "@components/not-found";
import { RouteError } from "@components/route-error";
import { AppShell } from "@features/navigation/components/app-shell";
import { VaultDropZone } from "@features/vault/components/vault-drop-zone";
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
  pendingComponent: Loading,
  errorComponent: RouteError,
  notFoundComponent: NotFound,
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname === "/onboarding") {
    return <Outlet />;
  }

  return (
    <AppShell user={user}>
      <VaultDropZone />
      <Toaster />
      <Outlet />
    </AppShell>
  );
}
