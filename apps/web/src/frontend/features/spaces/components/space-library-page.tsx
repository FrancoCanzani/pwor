import { CaretDownIcon, PlusIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";

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

type LibraryRow =
  | {
      key: string;
      kind: "note";
      title: string;
      updatedAt: number;
      note: NoteListItem;
    }
  | {
      key: string;
      kind: "vault";
      title: string;
      label: string;
      updatedAt: number;
      item: VaultItem;
    };

const FILTERS: { id: LibraryKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "snippets", label: "Snippets" },
  { id: "links", label: "Links" },
  { id: "files", label: "Files" },
  { id: "text", label: "Text" },
];

export function SpaceLibraryPage() {
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const search = useSearch({ from: "/_app/$workspaceId/" });
  const navigate = useNavigate({ from: "/$workspaceId/" });
  const { open: openCreate } = useCreateDialog();
  const { openNew: openNewNote } = useFloatingNote();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryKind>("all");

  const { data: workspaces = [] } = useQuery(workspacesQueryOptions);
  const space = workspaces.find((item) => item.id === workspaceId);
  const spaceTitle = space?.name.trim() || "Untitled";

  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));
  const { data: vaultList } = useQuery(vaultItemsQueryOptions(workspaceId));
  const vaultItems = vaultList?.items ?? [];
  const hasCaptured = notes.length > 0 || vaultItems.length > 0;

  const filterLabel =
    FILTERS.find((item) => item.id === filter)?.label ?? "All";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: LibraryRow[] = [];

    if (filter === "all" || filter === "notes") {
      for (const note of notes) {
        const title = note.title?.trim() || "Untitled";
        if (q && !title.toLowerCase().includes(q)) continue;
        list.push({
          key: `note:${note.id}`,
          kind: "note",
          title,
          updatedAt: toEpochMs(note.updatedAt),
          note,
        });
      }
    }

    for (const item of vaultItems) {
      if (filter === "notes") continue;
      if (filter === "snippets" && item.kind !== "snippet") continue;
      if (filter === "links" && item.kind !== "link") continue;
      if (filter === "text" && item.kind !== "text") continue;
      if (filter === "files" && item.kind !== "file") continue;

      const title = item.title?.trim() || "Untitled";
      const haystack = [title, item.summary, item.language, ...(item.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) continue;

      list.push({
        key: `vault:${item.id}`,
        kind: "vault",
        title,
        label: kindLabel(item),
        updatedAt: toEpochMs(item.createdAt),
        item,
      });
    }

    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [notes, vaultItems, filter, query]);

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
        <div className="mx-auto w-full max-w-3xl px-8 pt-6 pb-20">
          {rows.length === 0 ? (
            <PageEmpty
              title="Nothing here yet"
              description="Open a note or capture a URL, text, or file into this space."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((row) => (
                <li key={row.key}>
                  {row.kind === "note" ? (
                    <Link
                      to="/$workspaceId/notes/$noteId"
                      params={{
                        workspaceId,
                        noteId: row.note.id,
                      }}
                      className="flex items-baseline justify-between gap-4 py-3 no-underline"
                    >
                      <span className="min-w-0 truncate text-sm">
                        {row.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        note
                      </span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-4 py-3 text-left"
                      onClick={() => setOpenItem(row.item)}
                    >
                      <span className="min-w-0 truncate text-sm">
                        {row.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.label}
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
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
