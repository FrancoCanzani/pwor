import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";
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
import { PackSourcesList } from "@features/packs/components/pack-sources-list";

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
}: {
  workspaceId: string;
  packId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pack } = useQuery(packQueryOptions(packId));
  const { data: sources = [] } = useQuery(packSourcesQueryOptions(packId));
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

  if (!pack) return null;

  const updated = formatUpdated(pack.updatedAt);
  const readyCount = sources.filter((item) => item.parseStatus === "ready").length;
  const pendingCount = sources.filter(
    (item) => item.parseStatus === "pending",
  ).length;

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
    <div className="mx-auto flex w-full max-w-3xl flex-col px-8 pt-10 pb-20">
      <div className="mb-2">
        <Link
          to="/$workspaceId"
          params={{ workspaceId }}
          className="text-xs text-muted-foreground no-underline hover:text-foreground"
        >
          Packs
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={handleRename} className="flex max-w-md gap-2">
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
            <h1 className="text-lg font-normal tracking-tight">{pack.name}</h1>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
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

      <PackDropZone packId={packId} />
      <PackSourcesList packId={packId} />
    </div>
  );
}
