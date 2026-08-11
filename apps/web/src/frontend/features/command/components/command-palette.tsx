import { Dialog } from "@base-ui/react/dialog";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  MIN_QUERY_LENGTH,
  searchQueryOptions,
  type SearchHit,
  type SearchKind,
} from "@features/command/api";
import { fuzzyScore } from "@features/command/lib/score";
import { workspacesQueryOptions } from "@features/workspaces/api";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

/** Every destination shares a single `{ workspaceId }` param, which keeps
 *  `navigate` type-safe across the union. Note detail is handled separately. */
const NAV_ITEMS = [
  { to: "/$workspaceId/notes", label: "Notes" },
  { to: "/$workspaceId/vault", label: "Vault" },
] as const;

const KIND_META = {
  note: { label: "Notes", to: "/$workspaceId/notes" },
  vault_item: { label: "Vault", to: "/$workspaceId/vault" },
} as const satisfies Record<SearchKind, { label: string; to: string }>;

const KIND_ORDER: SearchKind[] = ["note", "vault_item"];
type PaletteItem = {
  id: string;
  label: string;
  detail?: string | null;
  meta?: string;
  index: number;
  run: () => void;
};

const SEARCH_DEBOUNCE_MS = 120;

// Stable fallbacks: a fresh `[]` per render would rebuild `items` every render.
const NO_HITS: SearchHit[] = [];
const NO_WORKSPACES: { id: string; name: string }[] = [];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { id: currentWorkspaceId } = useCurrentWorkspace();
  const { data: workspaces = NO_WORKSPACES } = useQuery(workspacesQueryOptions);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: hits = NO_HITS } = useQuery(searchQueryOptions(debouncedQuery));

  useHotkey("Mod+K", () => setOpen((previous) => !previous));

  const { sections, items } = useMemo(() => {
    const term = query.trim();
    const groups: { label: string; items: Omit<PaletteItem, "index">[] }[] = [];

    function select(workspaceId: string, run: () => void) {
      setOpen(false);
      setQuery("");
      setStoredWorkspaceId(workspaceId);
      run();
    }

    if (currentWorkspaceId) {
      const jumps: Omit<PaletteItem, "index">[] = [
        ...NAV_ITEMS.map((item) => ({
          id: `nav:${item.to}`,
          label: item.label,
          run: () =>
            select(currentWorkspaceId, () =>
              navigate({
                to: item.to,
                params: { workspaceId: currentWorkspaceId },
              }),
            ),
        })),
        ...workspaces
          .filter((workspace) => workspace.id !== currentWorkspaceId)
          .map((workspace) => ({
            id: `workspace:${workspace.id}`,
            label: workspace.name,
            meta: "Workspace",
            run: () =>
              select(workspace.id, () =>
                navigate({
                  to: "/$workspaceId/notes",
                  params: { workspaceId: workspace.id },
                }),
              ),
          })),
      ];

      const matched = term ? rank(jumps, term) : jumps;
      if (matched.length > 0) groups.push({ label: "Go to", items: matched });
    }

    for (const kind of KIND_ORDER) {
      const matches = hits.filter((hit) => hit.kind === kind);
      if (matches.length === 0) continue;

      groups.push({
        label: KIND_META[kind].label,
        items: matches.map((hit) => ({
          id: `${hit.kind}:${hit.id}`,
          label: hit.title,
          detail: hit.snippet,
          meta: workspaceLabel(hit, currentWorkspaceId, workspaces),
          run: () => {
            const workspaceId = hit.workspaceId ?? currentWorkspaceId;
            if (!workspaceId) return;
            select(workspaceId, () => {
              switch (hit.kind) {
                case "note":
                  return navigate({
                    to: "/$workspaceId/notes/$noteId",
                    params: { workspaceId, noteId: hit.id },
                  });
                case "vault_item":
                  return navigate({
                    to: "/$workspaceId/vault",
                    params: { workspaceId },
                    search: { item: hit.id },
                  });
                default: {
                  const _exhaustive: never = hit.kind;
                  return _exhaustive;
                }
              }
            });
          },
        })),
      });
    }

    let index = 0;
    const sections = groups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({ ...item, index: index++ })),
    }));

    return { sections, items: sections.flatMap((section) => section.items) };
  }, [query, hits, workspaces, currentWorkspaceId, navigate]);

  // Keyed on the query and the result count, not on `items` identity — a
  // reset on every re-render would undo each arrow press.
  useEffect(() => setActiveIndex(0), [query, items.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function move(delta: number) {
    if (items.length === 0) return;
    setActiveIndex(
      (current) => (current + delta + items.length) % items.length,
    );
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[activeIndex]?.run();
    }
  }

  const searching = query.trim().length >= MIN_QUERY_LENGTH;
  const activeId = items[activeIndex]?.id;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed top-[14vh] left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <Dialog.Title className="sr-only">Search and jump to</Dialog.Title>

          <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or jump to…"
              role="combobox"
              aria-expanded
              aria-controls="command-list"
              aria-activedescendant={activeId}
              className="h-full w-full bg-transparent text-[13px] font-normal placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>

          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            className="scrollbar-thin max-h-[min(24rem,50vh)] overflow-y-auto overscroll-contain p-1"
          >
            {sections.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">
                {searching ? "No matches" : "Type to search"}
              </p>
            ) : (
              sections.map((section) => (
                <div key={section.label} className="pb-1 last:pb-0">
                  <div className="px-2 py-1.5 text-[10px] leading-none text-muted-foreground">
                    {section.label}
                  </div>
                  {section.items.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      active={item.index === activeIndex}
                      onActivate={() => setActiveIndex(item.index)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            <Hint keys="↑↓" label="navigate" />
            <Hint keys="↵" label="open" />
            <Hint keys="esc" label="close" />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({
  item,
  active,
  onActivate,
}: {
  item: PaletteItem;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <div
      id={item.id}
      role="option"
      aria-selected={active}
      data-active={active}
      onClick={item.run}
      onMouseMove={onActivate}
      className={cn(
        "flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-xs select-none",
        active && "bg-muted",
      )}
    >
      <span className="min-w-0 truncate">{item.label}</span>
      {item.detail ? (
        <span className="hidden min-w-0 flex-1 truncate text-[11px] text-muted-foreground sm:block">
          {item.detail}
        </span>
      ) : null}
      {item.meta ? (
        <span className="ml-auto shrink-0 pl-2 text-[10px] text-muted-foreground">
          {item.meta}
        </span>
      ) : null}
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded-sm border border-border px-1 py-0.5 text-[10px] leading-none">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

function rank<T extends { label: string }>(items: T[], term: string): T[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(item.label, term) }))
    .filter(
      (entry): entry is { item: T; score: number } => entry.score !== null,
    )
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/** Results are cross-workspace, so off-workspace hits say where they live. */
function workspaceLabel(
  hit: SearchHit,
  currentWorkspaceId: string | undefined,
  workspaces: { id: string; name: string }[],
) {
  if (!hit.workspaceId || hit.workspaceId === currentWorkspaceId)
    return undefined;
  return workspaces.find((workspace) => workspace.id === hit.workspaceId)?.name;
}
