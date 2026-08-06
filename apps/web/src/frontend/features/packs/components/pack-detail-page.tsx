import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type SubmitEvent } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  deletePack,
  packQueryOptions,
  packsQueryOptions,
  packSourcesQueryOptions,
  updatePack,
} from "@features/packs/api";
import { PackDropZone } from "@features/packs/components/pack-drop-zone";
import {
  PackSourcePane,
  PackSourcesAside,
} from "@features/packs/components/pack-source-pane";

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

export function PackDetailPage({
  workspaceId,
  packId,
  selectedSourceId,
}: {
  workspaceId: string;
  packId: string;
  selectedSourceId: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pack } = useQuery(packQueryOptions(packId));
  const { data: sources = [] } = useQuery({
    ...packSourcesQueryOptions(packId),
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      return items.some((item) => item.parseStatus === "pending") ? 1500 : false;
    },
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const rename = useMutation({
    mutationFn: (next: string) => updatePack(packId, { name: next }),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({
        queryKey: packQueryOptions(packId).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: packsQueryOptions(workspaceId).queryKey,
      });
    },
  });

  const remove = useMutation({
    mutationFn: () => deletePack(packId),
    onSuccess: async () => {
      toast.success("Pack deleted");
      await queryClient.invalidateQueries({
        queryKey: packsQueryOptions(workspaceId).queryKey,
      });
      await navigate({
        to: "/$workspaceId",
        params: { workspaceId },
      });
    },
  });

  useEffect(() => {
    if (selectedSourceId) {
      const exists = sources.some((item) => item.id === selectedSourceId);
      if (!exists && sources.length > 0) {
        void navigate({
          to: "/$workspaceId/packs/$packId",
          params: { workspaceId, packId },
          search: { source: sources[0]!.id },
          replace: true,
        });
      }
      return;
    }
    if (sources.length > 0) {
      void navigate({
        to: "/$workspaceId/packs/$packId",
        params: { workspaceId, packId },
        search: { source: sources[0]!.id },
        replace: true,
      });
    }
  }, [selectedSourceId, sources, navigate, workspaceId, packId]);

  if (!pack) return null;

  const updated = formatUpdated(pack.updatedAt);
  const readyCount = sources.filter((item) => item.parseStatus === "ready")
    .length;
  const pendingCount = sources.filter(
    (item) => item.parseStatus === "pending",
  ).length;

  function selectSource(id: string) {
    void navigate({
      to: "/$workspaceId/packs/$packId",
      params: { workspaceId, packId },
      search: { source: id },
      replace: true,
    });
  }

  function clearSource() {
    void navigate({
      to: "/$workspaceId/packs/$packId",
      params: { workspaceId, packId },
      search: {},
      replace: true,
    });
  }

  function startEdit() {
    setName(pack!.name);
    setEditing(true);
  }

  function handleRename(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || rename.isPending) return;
    rename.mutate(trimmed);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link
            to="/$workspaceId"
            params={{ workspaceId }}
            className="text-[11px] text-muted-foreground no-underline hover:text-foreground"
          >
            All packs
          </Link>
          {editing ? (
            <form onSubmit={handleRename} className="mt-1 flex max-w-md gap-2">
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={rename.isPending}
              />
              <Button
                type="submit"
                size="sm"
                className="font-normal"
                disabled={!name.trim() || rename.isPending}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="font-normal"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <h1 className="mt-0.5 text-base font-normal tracking-tight">
              {pack.name}
            </h1>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-nums">{sources.length}</span> sources
            {readyCount > 0 ? (
              <span className="font-nums"> · {readyCount} ready</span>
            ) : null}
            {pendingCount > 0 ? (
              <span className="font-nums"> · {pendingCount} parsing</span>
            ) : null}
            {updated ? (
              <span className="font-nums"> · Updated {updated}</span>
            ) : null}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Pack actions"
              />
            }
          >
            <DotsHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="font-normal text-xs"
              onClick={startEdit}
            >
              Rename
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <DropdownMenuItem
                    className="font-normal text-xs text-destructive"
                    onSelect={(event) => event.preventDefault()}
                  />
                }
              >
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete pack?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the pack and its source links. Shared originals
                    are kept if other packs still use them.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => remove.mutate()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="shrink-0 border-b border-border px-4 py-3">
        <PackDropZone packId={packId} />
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border md:w-64">
          <div className="sticky top-0 z-10 border-b border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
            Sources
          </div>
          <PackSourcesAside
            packId={packId}
            selectedId={selectedSourceId}
            onSelect={selectSource}
          />
        </aside>

        <main className="min-w-0 flex-1">
          {selectedSourceId ? (
            <PackSourcePane
              packId={packId}
              sourceId={selectedSourceId}
              onRemoved={clearSource}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
              Drop something or select a source.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
