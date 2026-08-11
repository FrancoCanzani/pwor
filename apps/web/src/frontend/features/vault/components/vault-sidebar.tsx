import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createVaultCategory,
  type VaultCategory,
  type VaultItem,
} from "@features/vault/api";
import {
  VaultCategoryRow,
  VaultNavButton,
} from "@features/vault/components/vault-category-row";
import { VaultNewButton } from "@features/vault/components/vault-new-dialog";
import {
  TYPE_FACET_LABEL,
  TYPE_FACET_ORDER,
  typeFacetOf,
  type VaultTypeFacet,
} from "@features/vault/lib/category";
import type { VaultNav } from "@features/vault/lib/list";
import { formatGb } from "@features/vault/lib/size";

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
            <VaultNavButton
              active={nav.mode === "all"}
              label="All"
              count={items.length}
              onClick={() => onNavChange({ mode: "all" })}
            />
          </li>
          <li>
            <VaultNavButton
              active={nav.mode === "uncategorized"}
              label="Uncategorized"
              count={uncategorizedCount}
              onClick={() => onNavChange({ mode: "uncategorized" })}
            />
          </li>
        </ul>

        <p className="mt-4 mb-1 px-2 text-xs text-muted-foreground">Types</p>
        <ul className="flex flex-col gap-0.5">
          {TYPE_FACET_ORDER.map((facet) => (
            <li key={facet}>
              <VaultNavButton
                active={nav.mode === "type" && nav.type === facet}
                label={TYPE_FACET_LABEL[facet]}
                count={typeCounts.get(facet) ?? 0}
                onClick={() => onNavChange({ mode: "type", type: facet })}
              />
            </li>
          ))}
        </ul>

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
            <VaultCategoryRow
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
