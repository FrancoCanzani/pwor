import {
  CaretDownIcon,
  CaretSortIcon,
  CaretUpIcon,
  DotsHorizontalIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageEmpty } from "@components/page-empty";
import { useCreateDialog } from "@features/command/create-dialog-context";
import {
  deleteNote,
  notesQueryOptions,
  type NoteListItem,
} from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import {
  deleteVaultItem,
  vaultItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { VaultRenameDialog } from "@features/vault/components/vault-rename-dialog";
import { VaultViewer } from "@features/vault/components/vault-viewer";
import { formatBytes } from "@features/vault/lib/size";
import { workspacesQueryOptions } from "@features/workspaces/api";
import { toEpochMs } from "@shared/time";

type LibraryKind = "all" | "notes" | "snippets" | "links" | "files" | "text";

type LibraryRow = {
  key: string;
  title: string;
  typeLabel: string;
  facet: Exclude<LibraryKind, "all">;
  searchText: string;
  uploadedAt: number;
  kind: "note" | "vault";
  tags: string[];
  sizeBytes: number | null;
  pending: boolean;
  note?: NoteListItem;
  item?: VaultItem;
};

const FILTERS: { id: LibraryKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "snippets", label: "Snippets" },
  { id: "links", label: "Links" },
  { id: "files", label: "Files" },
  { id: "text", label: "Text" },
];

const FACET_TYPE_LABEL: Record<Exclude<LibraryKind, "all">, string> = {
  notes: "Note",
  snippets: "Snippet",
  links: "Link",
  files: "File",
  text: "Text",
};

const spaceLibraryFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

function formatUploadDate(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SortableHeader({
  header,
  children,
  className,
  align = "start",
}: {
  header: Header<typeof spaceLibraryFeatures, LibraryRow, unknown>;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const sorted = header.column.getIsSorted();
  const icon =
    sorted === "asc" ? (
      <CaretUpIcon className="size-3 shrink-0" />
    ) : sorted === "desc" ? (
      <CaretDownIcon className="size-3 shrink-0" />
    ) : (
      <CaretSortIcon className="size-3 shrink-0 opacity-50" />
    );

  return (
    <button
      type="button"
      className={
        className ??
        (align === "end"
          ? "inline-flex w-full items-center justify-end gap-1 text-sm font-normal text-muted-foreground hover:text-foreground"
          : "inline-flex items-center gap-1 text-sm font-normal text-muted-foreground hover:text-foreground")
      }
      onClick={header.column.getToggleSortingHandler()}
    >
      {align === "end" ? (
        <>
          {icon}
          {children}
        </>
      ) : (
        <>
          {children}
          {icon}
        </>
      )}
    </button>
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
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem
            className="font-normal text-xs"
            onClick={onView}
          >
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

export function SpaceLibraryPage() {
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const search = useSearch({ from: "/_app/$workspaceId/" });
  const navigate = useNavigate({ from: "/$workspaceId/" });
  const { open: openCreate } = useCreateDialog();
  const { openNew: openNewNote, openNote } = useFloatingNote();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryKind>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "uploadedAt", desc: true },
  ]);

  const { data: workspaces = [] } = useQuery(workspacesQueryOptions);
  const space = workspaces.find((item) => item.id === workspaceId);
  const spaceTitle = space?.name.trim() || "Untitled";

  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));
  const { data: vaultList } = useQuery(vaultItemsQueryOptions(workspaceId));
  const vaultItems = vaultList?.items ?? [];
  const hasCaptured = notes.length > 0 || vaultItems.length > 0;

  const filterLabel =
    FILTERS.find((item) => item.id === filter)?.label ?? "All";

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
        sizeBytes: null,
        pending: false,
        note,
      });
    }

    for (const item of vaultItems) {
      const title = item.title?.trim() || "Untitled";
      const facet: Exclude<LibraryKind, "all"> =
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
        sizeBytes: item.sizeBytes ?? null,
        pending: item.parseStatus === "pending",
        item,
      });
    }

    return list;
  }, [notes, vaultItems]);

  const columnFilters = useMemo<ColumnFiltersState>(
    () => (filter === "all" ? [] : [{ id: "type", value: filter }]),
    [filter],
  );

  function setOpenItem(item: VaultItem | null) {
    void navigate({
      search: item ? { item: item.id } : {},
      replace: true,
    });
  }

  function openRow(row: LibraryRow) {
    if (row.kind === "note" && row.note) {
      openNote(row.note.id);
      return;
    }
    if (row.kind === "vault" && row.item) {
      setOpenItem(row.item);
    }
  }

  const columns: ColumnDef<typeof spaceLibraryFeatures, LibraryRow>[] = [
    {
      accessorKey: "title",
      header: ({ header }) => (
        <SortableHeader header={header}>Name</SortableHeader>
      ),
      cell: ({ row: { original: row } }) => (
        <div
          className={
            row.pending
              ? "flex min-w-0 flex-col gap-0.5 animate-pulse"
              : "flex min-w-0 flex-col gap-0.5"
          }
        >
          <span className="min-w-0 truncate text-sm">{row.title}</span>
          {row.tags.length > 0 ? (
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {row.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="shrink-0 capitalize">
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ),
      enableGlobalFilter: true,
    },
    {
      id: "type",
      accessorKey: "typeLabel",
      header: ({ header }) => (
        <SortableHeader header={header} align="end">
          Type
        </SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="block text-xs text-muted-foreground capitalize">
          {getValue<string>()}
        </span>
      ),
      filterFn: (row, _columnId, filterValue) => {
        if (!filterValue || filterValue === "all") return true;
        return row.original.facet === filterValue;
      },
      enableGlobalFilter: false,
    },
    {
      id: "size",
      accessorKey: "sizeBytes",
      header: ({ header }) => (
        <SortableHeader header={header} align="end">
          Size
        </SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="block font-nums text-xs whitespace-nowrap text-muted-foreground">
          {formatBytes(getValue<number | null>())}
        </span>
      ),
      enableGlobalFilter: false,
    },
    {
      accessorKey: "uploadedAt",
      header: ({ header }) => (
        <SortableHeader header={header} align="end">
          Uploaded
        </SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="block font-nums text-xs whitespace-nowrap text-muted-foreground">
          {formatUploadDate(getValue<number>())}
        </span>
      ),
      enableGlobalFilter: false,
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <LibraryRowActions
          row={row.original}
          onView={() => openRow(row.original)}
        />
      ),
      enableSorting: false,
      enableGlobalFilter: false,
    },
  ];

  const table = useTable({
    key: "space-library",
    features: spaceLibraryFeatures,
    columns,
    data,
    getRowId: (row) => row.key,
    state: {
      globalFilter: query,
      columnFilters,
      sorting,
    },
    onGlobalFilterChange: setQuery,
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnFilters) : updater;
      const value = next.find((item) => item.id === "type")?.value;
      if (
        value === "notes" ||
        value === "snippets" ||
        value === "links" ||
        value === "files" ||
        value === "text"
      ) {
        setFilter(value);
        return;
      }
      setFilter("all");
    },
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!q) return true;
      return row.original.searchText.includes(q);
    },
  });

  const rows = table.getRowModel().rows;

  const openItem =
    search.item != null
      ? (vaultItems.find((item) => item.id === search.item) ?? null)
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/40">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center gap-2 px-4">
          <h1 className="min-w-0 flex-1 truncate text-sm font-normal">
            {spaceTitle}
          </h1>
          {hasCaptured ? (
            <>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-7 max-w-[10rem] border-0 bg-transparent px-0 text-xs shadow-none focus-visible:border-0 focus-visible:ring-0 sm:max-w-xs"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  {filterLabel}
                  <CaretDownIcon className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-32">
                  {FILTERS.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      className="font-normal text-xs"
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
          <Button
            type="button"
            variant="new"
            className="h-auto shrink-0 px-1.5 py-1 text-xs leading-none font-normal"
            onClick={() => openNewNote()}
          >
            Note
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Capture"
            onClick={() => openCreate()}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-20">
          {!hasCaptured ? (
            <PageEmpty
              title="Nothing here yet"
              description="Open a note or capture a URL, text, or file into this space."
            />
          ) : rows.length === 0 ? (
            <PageEmpty
              title="No matches"
              description="Try a different search or filter."
            />
          ) : (
            <table className="w-full table-fixed border-collapse">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-dashed border-border/40"
                  >
                    {headerGroup.headers.map((header) => {
                      const id = header.column.id;
                      return (
                        <th
                          key={header.id}
                          className={
                            id === "uploadedAt"
                              ? "h-8 w-32 px-2 text-right"
                              : id === "size"
                                ? "h-8 w-16 px-2 text-right"
                                : id === "type"
                                  ? "h-8 w-20 px-2 text-right"
                                  : id === "actions"
                                    ? "h-8 w-8 px-2"
                                    : "h-8 px-2 text-left"
                          }
                        >
                          {header.isPlaceholder ? null : (
                            <table.FlexRender header={header} />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-dashed border-border/40 hover:bg-muted/40"
                    onClick={() => openRow(row.original)}
                  >
                    {row.getAllCells().map((cell) => {
                      const id = cell.column.id;
                      return (
                        <td
                          key={cell.id}
                          className={
                            id === "uploadedAt"
                              ? "min-h-8 px-2 py-1.5 text-right align-middle"
                              : id === "size"
                                ? "min-h-8 px-2 py-1.5 text-right align-middle"
                                : id === "type"
                                  ? "min-h-8 px-2 py-1.5 text-right align-middle"
                                  : id === "actions"
                                    ? "min-h-8 px-2 py-1.5 text-right align-middle"
                                    : "min-h-8 min-w-0 px-2 py-1.5 align-middle"
                          }
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {openItem ? (
        <VaultViewer
          item={openItem}
          open
          onOpenChange={(next) => {
            if (!next) setOpenItem(null);
          }}
        />
      ) : null}
    </div>
  );
}
