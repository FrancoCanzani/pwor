import { CaretDownIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageEmpty } from "@components/page-empty";
import { notesQueryOptions, type NoteListItem } from "@features/notes/api";
import {
  vaultItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { VaultViewer } from "@features/vault/components/vault-viewer";
import { kindLabel } from "@features/vault/lib/list";
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryKind>("all");
  const [openItem, setOpenItem] = useState<VaultItem | null>(null);

  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));
  const { data: vaultList } = useQuery(vaultItemsQueryOptions(workspaceId));
  const vaultItems = vaultList?.items ?? [];

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-8 pt-10 pb-6">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this space…"
            className="h-9 flex-1 text-sm font-normal"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground"
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
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 pb-20">
          {rows.length === 0 ? (
            <PageEmpty
              title="Nothing here yet"
              description="Create a note, snippet, or capture something into this space."
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
