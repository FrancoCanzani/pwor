import { DotsHorizontalIcon, UploadIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import {
  PackSourcePane,
  PackSourcesAside,
} from "@features/packs/components/pack-source-pane";
import { PackUploadDialog } from "@features/packs/components/pack-upload-dialog";

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
  const [uploadOpen, setUploadOpen] = useState(false);

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
    <div className="flex h-full min-h-0">
      <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border md:w-64">
        <div className="shrink-0 border-b border-border px-3 py-3">
          <div className="flex items-start justify-between gap-1">
            {editing ? (
              <form onSubmit={handleRename} className="min-w-0 flex-1">
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={rename.isPending}
                  className="h-7 text-xs"
                  onBlur={() => {
                    const trimmed = name.trim();
                    if (trimmed && trimmed !== pack.name) {
                      rename.mutate(trimmed);
                    } else {
                      setEditing(false);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditing(false);
                  }}
                />
              </form>
            ) : (
              <h1 className="min-w-0 flex-1 truncate text-sm font-normal tracking-tight">
                {pack.name}
              </h1>
            )}
            <div className="flex shrink-0 items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Add source"
                onClick={() => setUploadOpen(true)}
              >
                <UploadIcon />
              </Button>
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
                          This removes the pack and its source links. Shared
                          originals are kept if other packs still use them.
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
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-nums">{sources.length}</span>{" "}
            {sources.length === 1 ? "source" : "sources"}
            {readyCount > 0 ? (
              <span className="font-nums"> · {readyCount} ready</span>
            ) : null}
            {pendingCount > 0 ? (
              <span className="font-nums"> · {pendingCount} parsing</span>
            ) : null}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <PackSourcesAside
            packId={packId}
            selectedId={selectedSourceId}
            onSelect={selectSource}
          />
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1">
        {selectedSourceId ? (
          <PackSourcePane
            packId={packId}
            sourceId={selectedSourceId}
            onRemoved={clearSource}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
            <p className="text-sm text-muted-foreground">
              Add a source to get started.
            </p>
            <Button
              type="button"
              size="sm"
              className="font-normal"
              onClick={() => setUploadOpen(true)}
            >
              <UploadIcon className="size-3.5" />
              Add source
            </Button>
          </div>
        )}
      </main>

      <PackUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        packId={packId}
      />
    </div>
  );
}
