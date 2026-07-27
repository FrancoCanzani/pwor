import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";

import { Loading } from "@components/loading";
import { AppShell } from "@features/navigation/components/app-shell";
import { sessionQueryOptions } from "@lib/session";

function isProfileIncomplete(user: { name: string }) {
  return !user.name.trim();
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) throw redirect({ to: "/login" });

    const incomplete = isProfileIncomplete(session.user);
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
      <Outlet />
    </AppShell>
  );
}
