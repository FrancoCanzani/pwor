import { ChevronRightIcon, DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useParams } from "@tanstack/react-router";
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
  createVaultCategory,
  deleteVaultCategory,
  renameVaultCategory,
  type VaultCategory,
  type VaultItem,
} from "@features/vault/api";
import { VaultNewButton } from "@features/vault/components/vault-new-dialog";
import {
  TYPE_FACET_LABEL,
  TYPE_FACET_ORDER,
  typeFacetOf,
  type VaultTypeFacet,
} from "@features/vault/lib/category";
import type { VaultNav } from "@features/vault/lib/list";
import { formatGb } from "@features/vault/lib/size";

function NavButton({
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

function CategoryRow({
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
        <NavButton
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

export function VaultSidebar({
  items,
  categories,
  totalBytes,
  nav,
  onNavChange,
  className,
}: {
  items: VaultItem[];
  categories: VaultCategory[];
  totalBytes: number;
  nav: VaultNav;
  onNavChange: (nav: VaultNav) => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [typesOpen, setTypesOpen] = useState(false);

  function closeCreating() {
    setCreating(false);
    setNewName("");
  }

  useHotkey("Escape", () => closeCreating(), { enabled: creating });

  const typeCounts = new Map<VaultTypeFacet, number>();
  let uncategorizedCount = 0;
  const categoryCounts = new Map<string, number>();

  for (const item of items) {
    const facet = typeFacetOf(item);
    typeCounts.set(facet, (typeCounts.get(facet) ?? 0) + 1);
    if (!item.categoryId) uncategorizedCount += 1;
    else {
      categoryCounts.set(
        item.categoryId,
        (categoryCounts.get(item.categoryId) ?? 0) + 1,
      );
    }
  }

  const create = useMutation({
    mutationFn: () => createVaultCategory(newName.trim(), workspaceId),
    onSuccess: (created) => {
      setCreating(false);
      setNewName("");
      void queryClient.invalidateQueries({ queryKey: ["vault", "categories"] });
      onNavChange({ mode: "category", categoryId: created.id });
    },
    onError: () => toast.error("Couldn’t create category"),
  });

  const activeCategoryId =
    nav.mode === "category" ? nav.categoryId : null;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col md:border-r md:border-border/40",
        className,
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
        <h1 className="text-xs leading-none font-normal text-muted-foreground">
          Vault
        </h1>
        <VaultNewButton categoryId={activeCategoryId} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-2 pb-3">
        <ul className="flex flex-col gap-0.5">
          <li>
            <NavButton
              active={nav.mode === "all"}
              label="All"
              count={items.length}
              onClick={() => onNavChange({ mode: "all" })}
            />
          </li>
          <li>
            <NavButton
              active={nav.mode === "uncategorized"}
              label="Uncategorized"
              count={uncategorizedCount}
              onClick={() => onNavChange({ mode: "uncategorized" })}
            />
          </li>
        </ul>

        <div className="mt-4">
          <button
            type="button"
            aria-expanded={typesOpen}
            onClick={() => setTypesOpen((open) => !open)}
            className="mb-1 flex w-full items-center justify-between gap-1 px-2 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            Types
            <ChevronRightIcon
              className={cn(
                "size-3 shrink-0 transition-transform",
                typesOpen && "rotate-90",
              )}
            />
          </button>
          {typesOpen ? (
            <ul className="flex flex-col gap-0.5">
              {TYPE_FACET_ORDER.map((facet) => (
                <li key={facet}>
                  <NavButton
                    active={nav.mode === "type" && nav.type === facet}
                    label={TYPE_FACET_LABEL[facet]}
                    count={typeCounts.get(facet) ?? 0}
                    onClick={() => onNavChange({ mode: "type", type: facet })}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-4 mb-1 flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground">Categories</p>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (creating) closeCreating();
              else setCreating(true);
            }}
          >
            {creating ? "Cancel" : "New"}
          </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {creating ? (
            <li className="px-1 py-0.5">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!newName.trim() || create.isPending) return;
                  create.mutate();
                }}
                className="flex items-center gap-1"
              >
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="h-7 text-xs"
                  disabled={create.isPending}
                />
                <Button
                  type="submit"
                  size="xs"
                  variant="ghost"
                  disabled={!newName.trim() || create.isPending}
                >
                  Add
                </Button>
              </form>
            </li>
          ) : null}
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              count={categoryCounts.get(category.id) ?? 0}
              active={activeCategoryId === category.id}
              onSelect={() =>
                onNavChange({ mode: "category", categoryId: category.id })
              }
            />
          ))}
        </ul>
      </div>

      <div className="flex h-10 shrink-0 items-center px-4">
        <span className="font-nums text-xs text-muted-foreground">
          {formatGb(totalBytes)}
        </span>
      </div>
    </aside>
  );
}
