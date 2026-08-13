import { Cross2Icon } from "@radix-ui/react-icons";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useState, type DragEvent } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import { CaptureButton } from "@features/command/components/capture-button";
import { SpacePic } from "@features/spaces/components/space-pic";
import {
  deleteVaultItem,
  inboxItemsQueryOptions,
  updateVaultItemProject,
  type VaultItem,
} from "@features/vault/api";
import { VaultViewer } from "@features/vault/components/vault-viewer";
import {
  endPworItemDrag,
  setPworItemDrag,
} from "@features/vault/lib/drag";
import { formatVaultDate, kindLabel } from "@features/vault/lib/list";
import { workspacesQueryOptions } from "@features/workspaces/api";

export const inboxSearchSchema = z.object({
  item: z.string().optional(),
});

function InboxRow({
  item,
  selected,
  dragging,
  onOpen,
  onToggle,
  onDragStart,
  onDragEnd,
}: {
  item: VaultItem;
  selected: boolean;
  dragging: boolean;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}) {
  const title = item.title?.trim() || "Untitled";
  const meta = kindLabel(item);
  const didDrag = useRef(false);

  return (
    <li
      draggable
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest("[data-no-drag]")) {
          event.preventDefault();
          return;
        }
        didDrag.current = true;
        onDragStart(event);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex cursor-grab items-center gap-2 py-2 active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <span data-no-drag className="flex shrink-0 items-center">
        <Checkbox
          checked={selected}
          aria-label={`Select ${title}`}
          onCheckedChange={(checked) => onToggle(checked === true)}
        />
      </span>
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-0 text-left hover:bg-transparent"
        onClick={() => {
          if (didDrag.current) {
            didDrag.current = false;
            return;
          }
          onOpen();
        }}
      >
        <span className="truncate text-sm font-normal">{title}</span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">
          {meta}
        </span>
      </Button>
      <span className="shrink-0 text-xs font-nums text-muted-foreground">
        {formatVaultDate(item.createdAt)}
      </span>
    </li>
  );
}

function InboxSelectionBar({
  count,
  busy,
  onClear,
  onMove,
  onDelete,
}: {
  count: number;
  busy: boolean;
  onClear: () => void;
  onMove: (workspaceId: string) => void;
  onDelete: () => void;
}) {
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-border bg-background px-1 py-0.5">
        <span className="px-1.5 font-nums text-xs text-muted-foreground">
          {count}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal"
                disabled={busy || spaces.length === 0}
              />
            }
          >
            Move
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="min-w-40 shadow-none">
            {spaces.map((space) => (
              <DropdownMenuItem
                key={space.id}
                className="font-normal text-xs"
                onClick={() => onMove(space.id)}
              >
                <SpacePic shaderId={space.shader} className="size-3.5" />
                <span className="truncate">{space.name.trim() || "Untitled"}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="font-normal text-muted-foreground hover:text-destructive"
                disabled={busy}
              />
            }
          >
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {count === 1 ? "capture" : `${count} captures`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes{" "}
                {count === 1 ? "it" : "them"} from Inbox. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
              >
                {busy ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear selection"
          className="text-muted-foreground"
          onClick={onClear}
        >
          <Cross2Icon />
        </Button>
      </div>
    </div>
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/inbox/" });
  const search = useSearch({ from: "/_app/inbox/" });
  const { data } = useQuery(inboxItemsQueryOptions());
  const items = data?.items ?? [];
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());

  const selectedIds = items
    .map((item) => item.id)
    .filter((id) => selected.has(id));
  const selectedCount = selectedIds.length;

  const openItem =
    search.item != null
      ? (items.find((item) => item.id === search.item) ?? null)
      : null;

  useHotkey("Escape", () => setSelected(new Set()), {
    enabled: selectedCount > 0 && openItem == null,
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await deleteVaultItem(id);
    },
    onSuccess: async (_result, ids) => {
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      if (search.item && ids.includes(search.item)) {
        void navigate({ search: { item: undefined }, replace: true });
      }
    },
    onError: () => toast.error("Couldn’t delete"),
  });

  const moveMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      for (const id of selectedIds) {
        await updateVaultItemProject(id, workspaceId);
      }
    },
    onSuccess: async () => {
      const count = selectedIds.length;
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vault", "items"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
      toast.success(count > 1 ? `Moved ${count}` : "Moved");
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const busy = deleteMutation.isPending || moveMutation.isPending;

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function dragIdsFor(item: VaultItem): string[] {
    if (selected.has(item.id) && selectedCount > 1) return selectedIds;
    return [item.id];
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center gap-2 px-4">
          <h1 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
            Inbox
          </h1>
          <CaptureButton />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24">
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
                  selected={selected.has(item.id)}
                  dragging={draggingIds.has(item.id)}
                  onOpen={() =>
                    void navigate({ search: { item: item.id }, replace: true })
                  }
                  onToggle={(checked) => toggleSelected(item.id, checked)}
                  onDragStart={(event) => {
                    const ids = dragIdsFor(item);
                    setPworItemDrag(event, {
                      kind: "vault",
                      ids,
                      title: item.title?.trim() || "Untitled",
                      meta: kindLabel(item),
                      fromWorkspaceId: null,
                    });
                    setDraggingIds(new Set(ids));
                  }}
                  onDragEnd={() => {
                    endPworItemDrag();
                    setDraggingIds(new Set());
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedCount > 0 ? (
        <InboxSelectionBar
          count={selectedCount}
          busy={busy}
          onClear={() => setSelected(new Set())}
          onMove={(workspaceId) => moveMutation.mutate(workspaceId)}
          onDelete={() => deleteMutation.mutate(selectedIds)}
        />
      ) : null}

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
