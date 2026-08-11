import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  deleteVaultCategory,
  renameVaultCategory,
  type VaultCategory,
} from "@features/vault/api";

export function VaultNavButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className="font-nums shrink-0">{count}</span>
      ) : null}
    </button>
  );
}

export function VaultCategoryRow({
  category,
  count,
  active,
  onSelect,
}: {
  category: VaultCategory;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);

  const rename = useMutation({
    mutationFn: () => renameVaultCategory(category.id, name.trim()),
    onSuccess: () => {
      setRenaming(false);
      void queryClient.invalidateQueries({ queryKey: ["vault", "categories"] });
    },
    onError: () => toast.error("Couldn’t rename category"),
  });

  const remove = useMutation({
    mutationFn: () => deleteVaultCategory(category.id),
    onSuccess: () => {
      toast.success(`Deleted ${category.name}`);
      void queryClient.invalidateQueries({ queryKey: ["vault", "categories"] });
      void queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
    },
    onError: () => toast.error("Couldn’t delete category"),
  });

  if (renaming) {
    return (
      <li className="px-1 py-0.5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || rename.isPending) return;
            rename.mutate();
          }}
          className="flex items-center gap-1"
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs"
            disabled={rename.isPending}
          />
          <Button
            type="submit"
            size="xs"
            variant="ghost"
            disabled={!name.trim() || rename.isPending}
          >
            Save
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-0.5">
      <div className="min-w-0 flex-1">
        <VaultNavButton
          active={active}
          label={category.name}
          count={count}
          onClick={onSelect}
        />
      </div>
      <AlertDialog>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              />
            }
          >
            <DotsHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="font-normal text-xs"
              onClick={() => {
                setName(category.name);
                setRenaming(true);
              }}
            >
              Rename
            </DropdownMenuItem>
            <AlertDialogTrigger
              render={
                <DropdownMenuItem
                  variant="destructive"
                  className="font-normal text-xs"
                />
              }
            >
              Delete
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Items in this category become uncategorized. Nothing else is
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
