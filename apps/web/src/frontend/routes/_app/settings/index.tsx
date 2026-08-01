import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@components/page-header";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account preferences."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-normal tracking-tight">Account</h2>
        <div className="flex flex-col gap-1 text-xs">
          <div className="text-muted-foreground">Name</div>
          <div>{user.name.trim() || "—"}</div>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <div className="text-muted-foreground">Email</div>
          <div>{user.email}</div>
        </div>
      </section>
    </>
  );
}
