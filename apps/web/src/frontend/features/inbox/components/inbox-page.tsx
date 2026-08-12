import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

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
import { PageEmpty } from "@components/page-empty";
import { useCreateDialog } from "@features/command/create-dialog-context";
import {
  deleteVaultItem,
  inboxItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { VaultViewer } from "@features/vault/components/vault-viewer";
import { formatVaultDate, kindLabel } from "@features/vault/lib/list";

export const inboxSearchSchema = z.object({
  item: z.string().optional(),
});

function InboxRow({
  item,
  deletePending,
  onOpen,
  onDelete,
}: {
  item: VaultItem;
  deletePending: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const title = item.title?.trim() || "Untitled";

  return (
    <li className="flex items-baseline justify-between gap-4 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 items-baseline gap-2 text-left"
      >
        <span className="truncate text-sm">{title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {kindLabel(item)}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs font-nums text-muted-foreground">
          {formatVaultDate(item.createdAt)}
        </span>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal text-muted-foreground hover:text-destructive"
              />
            }
          >
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete capture?</AlertDialogTitle>
              <AlertDialogDescription>
                “{title}” will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deletePending}
                onClick={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
              >
                {deletePending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/inbox/" });
  const search = useSearch({ from: "/_app/inbox/" });
  const { open: openCreate } = useCreateDialog();
  const { data } = useQuery(inboxItemsQueryOptions());
  const items = data?.items ?? [];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openItem =
    search.item != null
      ? (items.find((item) => item.id === search.item) ?? null)
      : null;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVaultItem(id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      if (search.item === id) {
        void navigate({ search: { item: undefined }, replace: true });
      }
    },
    onError: () => toast.error("Couldn’t delete"),
    onSettled: () => setDeletingId(null),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/40">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center gap-2 px-4">
          <h1 className="min-w-0 flex-1 truncate text-sm font-normal">Inbox</h1>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="font-normal"
            onClick={() => openCreate()}
          >
            Capture
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          {items.length === 0 ? (
            <PageEmpty
              title="Nothing yet"
              description="Paste a link anywhere, capture from the extension, or forward email here."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-dashed divide-border">
              {items.map((item) => (
                <InboxRow
                  key={item.id}
                  item={item}
                  deletePending={deletingId === item.id}
                  onOpen={() =>
                    void navigate({ search: { item: item.id }, replace: true })
                  }
                  onDelete={() => deleteMutation.mutate(item.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {openItem ? (
        <VaultViewer
          item={openItem}
          open
          onOpenChange={(open) => {
            if (!open) {
              void navigate({ search: { item: undefined }, replace: true });
            }
          }}
        />
      ) : null}
    </div>
  );
}
