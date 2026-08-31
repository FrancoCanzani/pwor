import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  MIN_QUERY_LENGTH,
  searchQueryOptions,
  type SearchHit,
} from "@features/command/api";
import { useCaptureComposer } from "@features/command/capture-composer-context";
import { isCaptureUrl, captureHost } from "@features/command/lib/capture";
import { fuzzyScore } from "@features/command/lib/score";
import { spacesQueryOptions } from "@features/spaces/api";
import { setStoredSpaceId } from "@features/spaces/lib/current-space";
import { useCurrentSpace } from "@features/spaces/lib/use-current-space";

const SPACE_NAV_ITEMS = [
  { to: "/spaces/$spaceId", label: "Library" },
] as const;

const SEARCH_DEBOUNCE_MS = 120;
const NO_HITS: SearchHit[] = [];
const NO_SPACES: { id: string; name: string }[] = [];

export type PaletteItem = {
  id: string;
  label: string;
  detail?: string | null;
  meta?: string;
  index: number;
  run: () => void;
};

export function usePaletteItems(
  query: string,
  dismiss: () => void,
  options?: { idle?: boolean },
) {
  const idle = options?.idle ?? false;
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  const navigate = useNavigate();
  const { id: currentSpaceId } = useCurrentSpace();
  const { open: openCreate } = useCaptureComposer();
  const { data: spaces = NO_SPACES } = useQuery(spacesQueryOptions);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: hits = NO_HITS } = useQuery(searchQueryOptions(debouncedQuery));

  return useMemo(() => {
    const term = query.trim();
    if (!idle && !term) {
      return { sections: [] as { label: string; items: PaletteItem[] }[], items: [] as PaletteItem[] };
    }

    const groups: { label: string; items: Omit<PaletteItem, "index">[] }[] = [];

    function close() {
      dismissRef.current();
    }

    function select(spaceId: string, run: () => void) {
      close();
      setStoredSpaceId(spaceId);
      run();
    }

    const jumps: Omit<PaletteItem, "index">[] = [
      {
        id: "nav:/inbox",
        label: "Inbox",
        run: () => {
          close();
          void navigate({ to: "/inbox" });
        },
      },
      {
        id: "nav:/notes",
        label: "Notes",
        run: () => {
          close();
          void navigate({ to: "/notes" });
        },
      },
      ...(currentSpaceId
        ? SPACE_NAV_ITEMS.map((item) => ({
            id: `nav:${item.to}`,
            label: item.label,
            run: () =>
              select(currentSpaceId, () =>
                navigate({
                  to: item.to,
                  params: { spaceId: currentSpaceId },
                }),
              ),
          }))
        : []),
      ...spaces
        .filter((space) => space.id !== currentSpaceId)
        .map((space) => ({
          id: `space:${space.id}`,
          label: space.name,
          meta: "Space",
          run: () =>
            select(space.id, () =>
              navigate({
                to: "/spaces/$spaceId",
                params: { spaceId: space.id },
              }),
            ),
        })),
    ];

    const matched = term ? rank(jumps, term) : jumps;
    if (matched.length > 0) groups.push({ label: "Go to", items: matched });

    const actions: Omit<PaletteItem, "index">[] = [
      {
        id: "action:capture",
        label: "Capture",
        meta: "⌘U",
        run: () => {
          close();
          openCreate();
        },
      },
    ];
    const matchedActions = term ? rank(actions, term) : [...actions];
    if (isCaptureUrl(term)) {
      matchedActions.unshift({
        id: "action:capture-url",
        label: `Capture ${captureHost(term) ?? "link"}`,
        run: () => {
          close();
          openCreate({ input: term });
        },
      });
    }
    if (matchedActions.length > 0) {
      groups.push({ label: "Actions", items: matchedActions });
    }

    const searchHits =
      term.length >= MIN_QUERY_LENGTH ? hits : NO_HITS;

    if (searchHits.length > 0) {
      groups.push({
        label: "Results",
        items: searchHits.map((hit) => ({
          id: `${hit.kind}:${hit.id}`,
          label: hit.title,
          detail: hit.snippet,
          meta: hitMeta(hit, currentSpaceId, spaces),
          run: () => {
            switch (hit.kind) {
              case "item": {
                if (!hit.spaceId) {
                  close();
                  void navigate({
                    to: "/inbox",
                    search: { item: hit.id },
                  });
                  return;
                }
                const spaceId = hit.spaceId;
                select(spaceId, () =>
                  navigate({
                    to: "/spaces/$spaceId",
                    params: { spaceId },
                    search: { item: hit.id },
                  }),
                );
                return;
              }
              case "note": {
                const spaceId = hit.spaceId ?? currentSpaceId;
                if (!spaceId) return;
                select(spaceId, () =>
                  navigate({
                    to: "/notes/$noteId",
                    params: { noteId: hit.id },
                  }),
                );
                return;
              }
              default: {
                const _exhaustive: never = hit.kind;
                return _exhaustive;
              }
            }
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
  }, [
    query,
    hits,
    spaces,
    currentSpaceId,
    navigate,
    openCreate,
    idle,
  ]);
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

function hitMeta(
  hit: SearchHit,
  currentSpaceId: string | undefined,
  spaces: { id: string; name: string }[],
): string {
  switch (hit.kind) {
    case "note": {
      if (hit.spaceId && hit.spaceId !== currentSpaceId) {
        return spaces.find((space) => space.id === hit.spaceId)?.name ?? "Note";
      }
      return "Note";
    }
    case "item": {
      if (!hit.spaceId) return "Inbox";
      if (hit.spaceId === currentSpaceId) return "Library";
      return spaces.find((space) => space.id === hit.spaceId)?.name ?? "Library";
    }
    default: {
      const _exhaustive: never = hit.kind;
      return _exhaustive;
    }
  }
}
