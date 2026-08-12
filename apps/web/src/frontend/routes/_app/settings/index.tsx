import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@components/page-header";
import {
  regenerateUserInbox,
  simulateInboundEmail,
  userInboxQueryOptions,
} from "@features/inbox/api";

type ExtensionDevice = {
  id: string;
  name: string;
  start: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

async function listDevices(): Promise<ExtensionDevice[]> {
  const response = await fetch("/api/extension/devices");
  if (!response.ok) throw new Error("Failed to load devices");
  const body = (await response.json()) as { items: ExtensionDevice[] };
  return body.items;
}

async function revokeDevice(id: string) {
  const response = await fetch(`/api/extension/devices/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to revoke device");
}

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ["extension-devices"],
    queryFn: listDevices,
  });
  const inbox = useQuery(userInboxQueryOptions());

  const revoke = useMutation({
    mutationFn: revokeDevice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["extension-devices"] });
    },
  });

  const regenerate = useMutation({
    mutationFn: regenerateUserInbox,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userInboxQueryOptions().queryKey,
      });
      toast.success("New inbox address generated");
    },
    onError: () => toast.error("Couldn’t regenerate address"),
  });

  const simulate = useMutation({
    mutationFn: simulateInboundEmail,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      toast.success("Simulated email saved to Inbox");
    },
    onError: () => toast.error("Simulate failed"),
  });

  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  return (
    <>
      <PageHeader title="Settings" description="Account preferences." />

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

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[13px] font-normal tracking-tight">
          Email capture
        </h2>
        <p className="text-xs text-muted-foreground">
          Forward anything to your personal address and it lands in Inbox.
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="min-w-0 truncate text-left text-xs font-nums hover:underline"
              disabled={!inbox.data?.address}
              onClick={() => {
                if (!inbox.data?.address) return;
                void navigator.clipboard.writeText(inbox.data.address);
                toast.success("Copied");
              }}
            >
              {inbox.isPending
                ? "Loading…"
                : (inbox.data?.address ?? "Unavailable")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="font-normal"
              disabled={regenerate.isPending}
              onClick={() => regenerate.mutate()}
            >
              {regenerate.isPending ? "Generating…" : "Regenerate"}
            </Button>
            {isLocal ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal"
                disabled={simulate.isPending}
                onClick={() => simulate.mutate()}
              >
                {simulate.isPending ? "Simulating…" : "Simulate email"}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-[13px] font-normal tracking-tight">
          Browser extension
        </h2>
        <p className="text-xs text-muted-foreground">
          Linked browsers can capture pages and tweets into your Inbox.
        </p>
        {devices.data && devices.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">No linked browsers.</p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {(devices.data ?? []).map((device) => (
            <li
              key={device.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate">{device.name}</div>
                <div className="font-nums text-muted-foreground">
                  {device.start ? `${device.start}… · ` : null}
                  Linked {new Date(device.createdAt).toLocaleDateString()}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(device.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
