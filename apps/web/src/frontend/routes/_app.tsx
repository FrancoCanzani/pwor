import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Loading } from "@components/loading";
import { AppShell } from "@features/navigation/components/app-shell";
import { sessionQueryOptions } from "@lib/session";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) throw redirect({ to: "/login" });

    return {
      user: {
        name: session.user.name,
        email: session.user.email,
      },
    };
  },
  pendingComponent: Loading,
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}
