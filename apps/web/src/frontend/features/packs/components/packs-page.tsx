import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageEmpty } from "@components/page-empty";
import { packsQueryOptions, type Pack } from "@features/packs/api";
import { CreatePackDialog } from "@features/packs/components/create-pack-dialog";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PackRow({ pack, workspaceId }: { pack: Pack; workspaceId: string }) {
  const updated = formatUpdated(pack.updatedAt);

  return (
    <Link
      to="/$workspaceId/packs/$packId"
      params={{ workspaceId, packId: pack.id }}
      className="flex items-baseline justify-between gap-4 border-b border-border py-3 text-sm no-underline last:border-b-0 hover:bg-muted/40"
    >
      <span className="min-w-0 truncate font-normal text-foreground">
        {pack.name}
      </span>
      {updated ? (
        <span className="shrink-0 font-nums text-xs text-muted-foreground">
          {updated}
        </span>
      ) : null}
    </Link>
  );
}

export function PacksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: workspaceId, name: workspaceName } = useCurrentWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: packs = [] } = useQuery({
    ...packsQueryOptions(workspaceId),
    enabled: Boolean(workspaceId),
  });

  if (!workspaceId) return null;

  const currentWorkspaceId = workspaceId;

  async function handleCreated(pack: Pack) {
    await queryClient.invalidateQueries({
      queryKey: packsQueryOptions(currentWorkspaceId).queryKey,
    });
    await navigate({
      to: "/$workspaceId/packs/$packId",
      params: { workspaceId: currentWorkspaceId, packId: pack.id },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-8 pt-10 pb-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {workspaceName || "Workspace"}
          </p>
          <h1 className="text-lg font-normal tracking-tight">Packs</h1>
        </div>
        <Button
          type="button"
          size="sm"
          className="font-normal"
          onClick={() => setCreateOpen(true)}
        >
          New pack
        </Button>
      </div>

      {packs.length === 0 ? (
        <PageEmpty
          title="No packs yet"
          description="A pack is a boundary around a body of knowledge. Drop sources into it later."
          action={
            <Button
              type="button"
              size="sm"
              className="font-normal"
              onClick={() => setCreateOpen(true)}
            >
              New pack
            </Button>
          }
        />
      ) : (
        <div className="border-t border-border">
          {packs.map((pack) => (
            <PackRow
              key={pack.id}
              pack={pack}
              workspaceId={currentWorkspaceId}
            />
          ))}
        </div>
      )}

      <CreatePackDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={currentWorkspaceId}
        onCreated={handleCreated}
      />
    </div>
  );
}
