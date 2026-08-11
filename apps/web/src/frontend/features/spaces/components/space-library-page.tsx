import {
  CaretDownIcon,
  CaretSortIcon,
  CaretUpIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
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

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageEmpty } from "@components/page-empty";
import { useCreateDialog } from "@features/command/create-dialog-context";
import { notesQueryOptions, type NoteListItem } from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import {
  vaultItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { VaultViewer } from "@features/vault/components/vault-viewer";
import { kindLabel } from "@features/vault/lib/list";
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
}: {
  header: Header<typeof spaceLibraryFeatures, LibraryRow, unknown>;
  children: ReactNode;
  className?: string;
}) {
  const sorted = header.column.getIsSorted();
  return (
    <button
      type="button"
      className={
        className ??
        "inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
      }
      onClick={header.column.getToggleSortingHandler()}
    >
      {children}
      {sorted === "asc" ? (
        <CaretUpIcon className="size-3" />
      ) : sorted === "desc" ? (
        <CaretDownIcon className="size-3" />
      ) : (
        <CaretSortIcon className="size-3 opacity-50" />
      )}
    </button>
  );
}

const columns: ColumnDef<typeof spaceLibraryFeatures, LibraryRow>[] = [
  {
    accessorKey: "title",
    header: ({ header }) => (
      <SortableHeader header={header}>Name</SortableHeader>
    ),
    cell: ({ getValue }) => (
      <span className="min-w-0 truncate text-sm">{getValue<string>()}</span>
    ),
    enableGlobalFilter: true,
  },
  {
    id: "type",
    accessorKey: "typeLabel",
    header: ({ header }) => (
      <SortableHeader header={header}>Type</SortableHeader>
    ),
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">{getValue<string>()}</span>
    ),
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === "all") return true;
      return row.original.facet === filterValue;
    },
    enableGlobalFilter: false,
  },
  {
    accessorKey: "uploadedAt",
    header: ({ header }) => (
      <SortableHeader
        header={header}
        className="inline-flex w-full items-center justify-end gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
      >
        Uploaded
      </SortableHeader>
    ),
    cell: ({ getValue }) => (
      <span className="font-nums text-xs text-muted-foreground">
        {formatUploadDate(getValue<number>())}
      </span>
    ),
    enableGlobalFilter: false,
  },
];

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
        typeLabel: "note",
        facet: "notes",
        searchText: title.toLowerCase(),
        uploadedAt: toEpochMs(note.createdAt),
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
      const searchText = [title, item.summary, item.language, ...(item.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      list.push({
        key: `vault:${item.id}`,
        kind: "vault",
        title,
        typeLabel: kindLabel(item),
        facet,
        searchText,
        uploadedAt: toEpochMs(item.createdAt),
        item,
      });
    }

    return list;
  }, [notes, vaultItems]);

  const columnFilters = useMemo<ColumnFiltersState>(
    () => (filter === "all" ? [] : [{ id: "type", value: filter }]),
    [filter],
  );

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 pt-2 pb-20">
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
                    className="border-b border-border/40"
                  >
                    {headerGroup.headers.map((header) => {
                      const isUploaded = header.column.id === "uploadedAt";
                      const isType = header.column.id === "type";
                      return (
                        <th
                          key={header.id}
                          className={
                            isUploaded
                              ? "w-28 py-2 text-right"
                              : isType
                                ? "w-24 py-2 text-left"
                                : "py-2 text-left"
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
                    className="cursor-pointer border-b border-border hover:bg-muted/40"
                    onClick={() => openRow(row.original)}
                  >
                    {row.getAllCells().map((cell) => {
                      const isUploaded = cell.column.id === "uploadedAt";
                      const isType = cell.column.id === "type";
                      return (
                        <td
                          key={cell.id}
                          className={
                            isUploaded
                              ? "py-3 text-right"
                              : isType
                                ? "py-3 pr-4"
                                : "min-w-0 py-3 pr-4"
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
