import {
  DotsHorizontalIcon,
} from "@radix-ui/react-icons";
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
import { PageEmpty } from "@components/page-empty";
import {
  deletePack,
  packQueryOptions,
  packsQueryOptions,
  updatePack,
} from "@features/packs/api";

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
            0 sources
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
                    This removes the pack. Sources stay for now — linking comes
                    with ingestion.
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

      <div className="mb-10 border border-dashed border-border px-6 py-10 text-center">
        <p className="text-sm font-normal">Drop anything</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF · URL · Image · Text
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Ingestion comes next — this is the shell.
        </p>
      </div>

      <PageEmpty
        title="No sources yet"
        description="Sources you drop into this pack will show up here."
      />
    </div>
  );
}
