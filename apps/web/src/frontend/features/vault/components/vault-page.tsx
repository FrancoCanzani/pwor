import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageEmpty } from "@components/page-empty";
import {
  createVaultLink,
  createVaultText,
  deleteVaultItem,
  vaultItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { VaultSidebar } from "@features/vault/components/vault-sidebar";
import { VaultViewer } from "@features/vault/components/vault-viewer";
import { categoryOf, type VaultCategory } from "@features/vault/lib/category";

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function fileKindLabel(mimeType: string | null): string {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

function VaultLinkRow({ item }: { item: VaultItem }) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => deleteVaultItem(item.id),
    onSuccess: () => {
      toast.success(`Deleted ${item.title ?? "link"}`);
      queryClient.invalidateQueries({
        queryKey: ["vault", "items"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const domain = item.url ? domainOf(item.url) : "";

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <a
        href={item.url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-2 no-underline"
      >
        {domain ? (
          <img
            src={faviconUrl(domain)}
            alt=""
            className="size-4 shrink-0"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm">
            {item.siteName?.trim() || item.title || domain}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {domain}
          </span>
        </div>
      </a>

      <Button
        variant="ghost"
        size="sm"
        className="font-normal text-muted-foreground"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
      >
        Remove
      </Button>
    </li>
  );
}

function VaultFileRow({ item }: { item: VaultItem }) {
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);

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

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <button
        type="button"
        className="flex flex-col gap-0.5 text-left"
        onClick={() => setViewerOpen(true)}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-sm">{item.title ?? "Untitled"}</span>
          <span className="text-xs text-muted-foreground">
            {item.kind === "text" ? "text" : fileKindLabel(item.mimeType)}
          </span>
        </div>
      </button>

      <VaultViewer item={item} open={viewerOpen} onOpenChange={setViewerOpen} />

      <div className="flex items-center gap-3">
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <DotsHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.kind === "file" ? (
                <DropdownMenuItem
                  className="font-normal text-xs"
                  render={<a href={`/api/vault/${item.id}/file`} download />}
                >
                  Download
                </DropdownMenuItem>
              ) : null}
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
              <AlertDialogTitle>Delete {item.title ?? "item"}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the item from your vault. This can't
                be undone.
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

function VaultRow({ item }: { item: VaultItem }) {
  if (item.kind === "link") return <VaultLinkRow item={item} />;
  return <VaultFileRow item={item} />;
}

function VaultLinkQuickAdd() {
  const [url, setUrl] = useState("");
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  const addLink = useMutation({
    mutationFn: (url: string) => createVaultLink(url, workspaceId),
    onSuccess: () => {
      setUrl("");
      queryClient.invalidateQueries({
        queryKey: ["vault", "items"],
      });
    },
    onError: () => toast.error("Couldn't add that link"),
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || addLink.isPending) return;
    addLink.mutate(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a link…"
        className="font-normal"
      />
      <Button
        type="submit"
        className="font-normal"
        disabled={!url.trim() || addLink.isPending}
      >
        Add
      </Button>
    </form>
  );
}

function VaultTextQuickAdd() {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  const addText = useMutation({
    mutationFn: (content: string) => createVaultText(content, workspaceId),
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({
        queryKey: ["vault", "items"],
      });
    },
    onError: () => toast.error("Couldn't save that"),
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || addText.isPending) return;
    addText.mutate(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Jot something down…"
        className="font-normal"
      />
      <Button
        type="submit"
        className="font-normal"
        disabled={!content.trim() || addText.isPending}
      >
        Add
      </Button>
    </form>
  );
}

export function VaultPage() {
  const isMobile = useIsMobile();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const { data: items = [] } = useQuery(vaultItemsQueryOptions(workspaceId));
  const [category, setCategory] = useState<VaultCategory | null>(null);

  const filtered = category
    ? items.filter((item) => categoryOf(item) === category)
    : items;

  const content = (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain px-8 pt-10 pb-20">
      <div className="flex flex-col gap-8">
        {category === "links" ? (
          <VaultLinkQuickAdd />
        ) : category === "images" ? null : (
          <VaultTextQuickAdd />
        )}

        {filtered.length === 0 ? (
          <PageEmpty
            title={
              category ? `Nothing in ${category} yet` : "Nothing in the vault yet"
            }
            description={
              category === "links"
                ? "Paste a link above to add one."
                : category === "images"
                  ? "Drop an image anywhere to add it."
                  : "Jot something down above, or drop a file anywhere to add it."
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {filtered.map((item) => (
              <VaultRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const sidebar = (
    <VaultSidebar items={items} selected={category} onSelect={setCategory} />
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
