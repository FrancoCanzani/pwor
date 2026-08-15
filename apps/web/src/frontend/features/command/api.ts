import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type SearchKind = "note" | "item" | "feed";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string | null;
  workspaceId: string | null;
  feedId: string | null;
  updatedAt: number;
};

export const MIN_QUERY_LENGTH = 2;

async function fetchSearch(q: string): Promise<SearchHit[]> {
  const data = await parseJson<{ items: SearchHit[] }>(
    await fetch(`/api/search?q=${encodeURIComponent(q)}`),
  );
  return data.items;
}

export function searchQueryOptions(q: string) {
  const term = q.trim();
  return queryOptions({
    queryKey: ["search", term] as const,
    queryFn: () => fetchSearch(term),
    enabled: term.length >= MIN_QUERY_LENGTH,
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}
