import { CaretSortIcon, DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageEmpty } from "@components/page-empty";
import {
  deleteVaultItem,
  updateVaultItemCategory,
  vaultCategoriesQueryOptions,
  vaultItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { VaultSidebar } from "@features/vault/components/vault-sidebar";
import { VaultViewer } from "@features/vault/components/vault-viewer";
import {
  filterAndSortVaultItems,
  formatVaultDate,
  kindLabel,
  VAULT_SORT_LABEL,
  VAULT_SORT_ORDER,
  vaultNavFromSearch,
  vaultNavToSearch,
  type VaultNav,
  type VaultSort,
} from "@features/vault/lib/list";

function VaultItemRow({
  item,
  categories,
  onOpen,
}: {
  item: VaultItem;
  categories: { id: string; name: string }[];
  onOpen: (item: VaultItem) => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => deleteVaultItem(item.id),
    onSuccess: () => {
      toast.success(`Deleted ${item.title ?? "item"}`);
      queryClient.invalidateQueries({
        queryKey: ["vault", "items"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const move = useMutation({
    mutationFn: (categoryId: string | null) =>
      updateVaultItemCategory(item.id, categoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
    },
    onError: () => toast.error("Couldn’t move item"),
  });

  const tags = item.tags?.slice(0, 4) ?? [];

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
        onClick={() => onOpen(item)}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm">{item.title ?? "Untitled"}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {kindLabel(item)}
          </span>
          {item.parseStatus === "pending" ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              parsing
            </span>
          ) : null}
        </span>
        {item.summary || tags.length > 0 ? (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {item.summary ? (
              <span className="line-clamp-1 min-w-0 flex-1">{item.summary}</span>
            ) : null}
            {tags.map((tag) => (
              <span key={tag} className="shrink-0">
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </button>

      <div className="flex shrink-0 items-center gap-3">
        <span className="font-nums text-xs text-muted-foreground">
          {formatVaultDate(item.createdAt)}
        </span>

        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <DotsHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="font-normal text-xs"
                onClick={() => onOpen(item)}
              >
                Open
              </DropdownMenuItem>
              {item.url ? (
                <DropdownMenuItem
                  className="font-normal text-xs"
                  render={
                    <a href={item.url} target="_blank" rel="noreferrer" />
                  }
                >
                  Open link
                </DropdownMenuItem>
              ) : null}
              {item.kind === "file" ? (
                <DropdownMenuItem
                  className="font-normal text-xs"
                  render={<a href={`/api/vault/${item.id}/file`} download />}
                >
                  Download
                </DropdownMenuItem>
              ) : null}
              {categories.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="font-normal text-xs"
                    onClick={() => move.mutate(null)}
                  >
                    Uncategorized
                  </DropdownMenuItem>
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      className="font-normal text-xs"
                      onClick={() => move.mutate(category.id)}
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
              <DropdownMenuSeparator />
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
              <AlertDialogTitle>
                Delete {item.title ?? "item"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the item from your vault. This can't be
                undone.
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
      </div>
    </li>
  );
}

export function VaultPage() {
  const isMobile = useIsMobile();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const search = useSearch({ from: "/_app/$workspaceId/vault/" });
  const navigate = useNavigate({ from: "/$workspaceId/vault/" });
  const { data } = useQuery(vaultItemsQueryOptions(workspaceId));
  const { data: categories = [] } = useQuery(
    vaultCategoriesQueryOptions(workspaceId),
  );
  const items = data?.items ?? [];
  const totalBytes = data?.totalBytes ?? 0;
  const nav = vaultNavFromSearch(search);
  const openItemId = search.item;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<VaultSort>("newest");

  const filtered = filterAndSortVaultItems(items, { nav, query, sort });
  const openItem =
    openItemId != null
      ? (items.find((item) => item.id === openItemId) ?? null)
      : null;

  function setNav(next: VaultNav) {
    void navigate({
      search: (prev) => ({
        item: prev.item,
        ...vaultNavToSearch(next),
      }),
      replace: true,
    });
  }

  function setViewerOpen(open: boolean, itemId?: string) {
    void navigate({
      search: (prev) => ({
        ...vaultNavToSearch(vaultNavFromSearch(prev)),
        ...(open && itemId ? { item: itemId } : {}),
      }),
      replace: true,
    });
  }

  const emptyTitle = (() => {
    if (query.trim()) return "No matches";
    switch (nav.mode) {
      case "all":
        return "Nothing in the vault yet";
      case "uncategorized":
        return "Nothing uncategorized";
      case "type":
        return `Nothing in ${nav.type} yet`;
      case "category": {
        const name =
          categories.find((c) => c.id === nav.categoryId)?.name ?? "category";
        return `Nothing in ${name} yet`;
      }
      default: {
        const _exhaustive: never = nav;
        return _exhaustive;
      }
    }
  })();

  const toolbar = (
    <div className="flex h-12 shrink-0 items-center gap-2 px-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="h-7 max-w-xs border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
      />
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                className="gap-1 font-normal text-muted-foreground"
              />
            }
          >
            {VAULT_SORT_LABEL[sort]}
            <CaretSortIcon className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-28">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => {
                if (
                  value === "newest" ||
                  value === "oldest" ||
                  value === "name"
                ) {
                  setSort(value);
                }
              }}
            >
              {VAULT_SORT_ORDER.map((option) => (
                <DropdownMenuRadioItem
                  key={option}
                  value={option}
                  className="font-normal text-xs"
                >
                  {VAULT_SORT_LABEL[option]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const list = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-20">
      {filtered.length === 0 ? (
        <PageEmpty
          title={emptyTitle}
          description={
            query.trim()
              ? "Try a different search."
              : "Paste a link or text — or upload a file."
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-dashed divide-border">
          {filtered.map((item) => (
            <VaultItemRow
              key={item.id}
              item={item}
              categories={categories}
              onOpen={(next) => setViewerOpen(true, next.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );

  const content = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {toolbar}
      {list}
      {openItem ? (
        <VaultViewer
          item={openItem}
          open
          onOpenChange={(open) => setViewerOpen(open, openItem.id)}
        />
      ) : null}
    </div>
  );

  const sidebar = (
    <VaultSidebar
      items={items}
      categories={categories}
      totalBytes={totalBytes}
      nav={nav}
      onNavChange={setNav}
    />
  );

  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {sidebar}
        {content}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 overflow-hidden"
    >
      <ResizablePanel
        id="vault-aside"
        defaultSize={200}
        minSize={160}
        maxSize={360}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {sidebar}
      </ResizablePanel>

      <ResizableHandle className="w-px bg-border/40 after:w-px" />

      <ResizablePanel
        id="vault-content"
        defaultSize="80%"
        minSize="50%"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {content}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
