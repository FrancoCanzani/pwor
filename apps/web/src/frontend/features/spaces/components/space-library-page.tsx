import {
  CaretDownIcon,
  CodeIcon,
  DotsHorizontalIcon,
  EyeOpenIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
  ReaderIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import { CaptureButton } from "@features/command/components/capture-button";
import {
  deleteNote,
  notesQueryOptions,
  type NoteListItem,
} from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import { SpacePic } from "@features/spaces/components/space-pic";
import {
  deleteVaultItem,
  vaultItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { VaultItemPreview } from "@features/vault/components/vault-item-preview";
import { VaultRenameDialog } from "@features/vault/components/vault-rename-dialog";
import {
  endPworItemDrag,
  setPworItemDrag,
} from "@features/vault/lib/drag";
import { isSheetPreviewable } from "@features/vault/lib/sheet";
import { workspacesQueryOptions } from "@features/workspaces/api";
import { toEpochMs } from "@shared/time";

type LibraryFacet = "notes" | "snippets" | "links" | "files" | "text";

type LibraryRow = {
  key: string;
  title: string;
  typeLabel: string;
  facet: LibraryFacet;
  searchText: string;
  uploadedAt: number;
  kind: "note" | "vault";
  tags: string[];
  pending: boolean;
  note?: NoteListItem;
  item?: VaultItem;
};

const FACETS: { id: LibraryFacet; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "snippets", label: "Snippets" },
  { id: "links", label: "Links" },
  { id: "files", label: "Files" },
  { id: "text", label: "Text" },
];

const FACET_TYPE_LABEL: Record<LibraryFacet, string> = {
  notes: "Note",
  snippets: "Snippet",
  links: "Link",
  files: "File",
  text: "Text",
};

function formatShortDate(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function rowIcon(row: LibraryRow) {
  if (row.kind === "note") return ReaderIcon;
  const item = row.item;
  if (!item) return FileIcon;
  switch (item.kind) {
    case "snippet":
      return CodeIcon;
    case "link":
      return Link2Icon;
    case "text":
      return FileTextIcon;
    case "file":
      if (item.mimeType?.startsWith("image/")) return ImageIcon;
      if (item.mimeType === "application/pdf") return FileTextIcon;
      if (isSheetPreviewable(item.mimeType, item.title)) return FileIcon;
      return FileIcon;
    default: {
      const _exhaustive: never = item.kind;
      return _exhaustive;
    }
  }
}

function LibraryThumb({ row }: { row: LibraryRow }) {
  if (row.kind === "vault" && row.item) {
    const item = row.item;
    if (item.mimeType?.startsWith("image/")) {
      return (
        <img
          src={`/api/vault/${item.id}/file`}
          alt=""
          className="size-9 shrink-0 rounded-sm object-cover"
        />
      );
    }
    if (item.hasPreview) {
      return (
        <img
          src={`/api/vault/${item.id}/preview`}
          alt=""
          className="size-9 shrink-0 rounded-sm object-cover object-top"
        />
      );
    }
  }

  const Icon = rowIcon(row);
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
      <Icon className="size-4" />
    </div>
  );
}

function LibraryRowActions({
  row,
  onView,
}: {
  row: LibraryRow;
  onView: () => void;
}) {
  const queryClient = useQueryClient();
  const [renameOpen, setRenameOpen] = useState(false);

  const remove = useMutation({
    mutationFn: async () => {
      if (row.kind === "note" && row.note) {
        await deleteNote(row.note.id);
        return;
      }
      if (row.kind === "vault" && row.item) {
        await deleteVaultItem(row.item.id);
      }
    },
    onSuccess: () => {
      toast.success(`Deleted ${row.title}`);
      if (row.kind === "note") {
        void queryClient.invalidateQueries({ queryKey: ["notes"] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      }
    },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Actions"
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <DotsHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem className="font-normal text-xs" onClick={onView}>
            View
          </DropdownMenuItem>
          {row.kind === "vault" && row.item ? (
            <DropdownMenuItem
              className="font-normal text-xs"
              onClick={() => setRenameOpen(true)}
            >
              Rename
            </DropdownMenuItem>
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

      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {row.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes it from this space. This can’t be undone.
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

      {row.kind === "vault" && row.item ? (
        <VaultRenameDialog
          item={row.item}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
      ) : null}
    </AlertDialog>
  );
}

function LibraryListItem({
  row,
  active,
  workspaceId,
  onOpen,
}: {
  row: LibraryRow;
  active: boolean;
  workspaceId: string;
  onOpen: () => void;
}) {
  const meta = [row.typeLabel, formatShortDate(row.uploadedAt)]
    .filter(Boolean)
    .join(" · ");
  const [dragging, setDragging] = useState(false);
  const didDrag = useRef(false);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      className={cn(
        "group flex w-full cursor-grab items-start gap-3 border-b border-dashed border-border/40 px-4 py-3 text-left hover:bg-muted/40 active:cursor-grabbing",
        active && "bg-muted/50",
        row.pending && "animate-pulse",
        dragging && "opacity-40",
      )}
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest("[data-no-drag]")) {
          event.preventDefault();
          return;
        }
        const id = row.kind === "note" ? row.note?.id : row.item?.id;
        if (!id) {
          event.preventDefault();
          return;
        }
        didDrag.current = true;
        setPworItemDrag(event, {
          kind: row.kind,
          ids: [id],
          title: row.title,
          meta: row.typeLabel.toLowerCase(),
          fromWorkspaceId: workspaceId,
        });
        setDragging(true);
      }}
      onDragEnd={() => {
        endPworItemDrag();
        setDragging(false);
      }}
      onClick={() => {
        if (didDrag.current) {
          didDrag.current = false;
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <LibraryThumb row={row} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-normal">{row.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        {row.tags.length > 0 ? (
          <p className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {row.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="shrink-0 capitalize">
                {tag}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div
        data-no-drag
        className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Preview"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <EyeOpenIcon />
        </Button>
        <LibraryRowActions row={row} onView={onOpen} />
      </div>
    </div>
  );
}

export function SpaceLibraryPage() {
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const search = useSearch({ from: "/_app/$workspaceId/" });
  const navigate = useNavigate({ from: "/$workspaceId/" });
  const isMobile = useIsMobile();
  const { openNew: openNewNote, openNote, activeNoteId } = useFloatingNote();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<LibraryFacet>>(() => new Set());

  const { data: workspaces = [] } = useQuery(workspacesQueryOptions);
  const space = workspaces.find((item) => item.id === workspaceId);
  const spaceTitle = space?.name.trim() || "Untitled";

  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));
  const { data: vaultList } = useQuery(vaultItemsQueryOptions(workspaceId));
  const vaultItems = vaultList?.items ?? [];
  const hasCaptured = notes.length > 0 || vaultItems.length > 0;

  const filterLabel =
    filters.size === 0
      ? "All"
      : FACETS.filter((item) => filters.has(item.id))
          .map((item) => item.label)
          .join(", ");

  const data = useMemo(() => {
    const list: LibraryRow[] = [];

    for (const note of notes) {
      const title = note.title?.trim() || "Untitled";
      list.push({
        key: `note:${note.id}`,
        kind: "note",
        title,
        typeLabel: FACET_TYPE_LABEL.notes,
        facet: "notes",
        searchText: title.toLowerCase(),
        uploadedAt: toEpochMs(note.createdAt),
        tags: [],
        pending: false,
        note,
      });
    }

    for (const item of vaultItems) {
      const title = item.title?.trim() || "Untitled";
      const facet: LibraryFacet =
        item.kind === "snippet"
          ? "snippets"
          : item.kind === "link"
            ? "links"
            : item.kind === "text"
              ? "text"
              : "files";
      const searchText = [
        title,
        item.summary,
        item.language,
        ...(item.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      list.push({
        key: `vault:${item.id}`,
        kind: "vault",
        title,
        typeLabel: FACET_TYPE_LABEL[facet],
        facet,
        searchText,
        uploadedAt: toEpochMs(item.createdAt),
        tags: item.tags ?? [],
        pending: item.parseStatus === "pending",
        item,
      });
    }

    return list;
  }, [notes, vaultItems]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data
      .filter((row) => {
        if (filters.size > 0 && !filters.has(row.facet)) return false;
        if (!q) return true;
        return row.searchText.includes(q);
      })
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [data, filters, query]);

  function toggleFilter(id: LibraryFacet) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setOpenItem(item: VaultItem | null) {
    void navigate({
      search: item ? { item: item.id } : {},
      replace: true,
    });
  }

  function openRow(row: LibraryRow) {
    if (row.kind === "note" && row.note) {
      setOpenItem(null);
      openNote(row.note.id);
      return;
    }
    if (row.kind === "vault" && row.item) {
      setOpenItem(row.item);
    }
  }

  const openItem =
    search.item != null
      ? (vaultItems.find((item) => item.id === search.item) ?? null)
      : null;

  const previewOpen = openItem != null;

  const listPane = (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        previewOpen && isMobile && "hidden",
      )}
    >
      <div className="shrink-0">
        <div className="flex h-12 w-full items-center gap-2 px-4">
          <SpacePic shaderId={space?.shader} className="size-4" />
          <h1 className="min-w-0 flex-1 truncate text-base leading-none font-normal">
            {spaceTitle}
          </h1>
          {hasCaptured ? (
            <>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-7 max-w-[10rem] text-xs sm:max-w-xs"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="max-w-[8rem] font-normal text-muted-foreground"
                    />
                  }
                >
                  <span className="truncate">{filterLabel}</span>
                  <CaretDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-32">
                  {FACETS.map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item.id}
                      className="font-normal text-xs"
                      checked={filters.has(item.id)}
                      onCheckedChange={() => toggleFilter(item.id)}
                    >
                      {item.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
          <Button
            type="button"
            variant="new"
            size="sm"
            className="shrink-0 font-normal"
            onClick={() => openNewNote()}
          >
            New note
            <Kbd>⌘N</Kbd>
          </Button>
          <CaptureButton />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasCaptured ? (
          <div className="px-4 pt-6 pb-20">
            <PageEmpty
              title="Nothing here yet"
              description="Open a note or capture a URL, text, or file into this space."
              action={<CaptureButton />}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 pt-6 pb-20">
            <PageEmpty
              title="No matches"
              description="Try a different search or filter."
            />
          </div>
        ) : (
          <div className="flex flex-col pb-16">
            {rows.map((row) => {
              const active =
                row.kind === "vault"
                  ? row.item?.id === openItem?.id
                  : row.note?.id === activeNoteId;
              return (
                <LibraryListItem
                  key={row.key}
                  row={row}
                  active={Boolean(active)}
                  workspaceId={workspaceId}
                  onOpen={() => openRow(row)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const previewPane = openItem ? (
    <VaultItemPreview
      key={openItem.id}
      item={openItem}
      variant="panel"
      onClose={() => setOpenItem(null)}
    />
  ) : null;

  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {listPane}
        {previewOpen ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {previewPane}
          </div>
        ) : null}
      </div>
    );
  }

  if (!previewOpen) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {listPane}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 overflow-hidden"
    >
      <ResizablePanel
        id="library-list"
        defaultSize="58%"
        minSize="32%"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {listPane}
      </ResizablePanel>
      <ResizableHandle className="w-px bg-border/40 after:w-px" />
      <ResizablePanel
        id="library-preview"
        defaultSize="42%"
        minSize="28%"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {previewPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
