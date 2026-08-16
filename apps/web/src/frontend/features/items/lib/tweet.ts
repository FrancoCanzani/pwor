import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import type { TweetView } from "@shared/tweet";

export function tweetQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["tweet", id] as const,
    queryFn: async () => parseJson<TweetView>(await fetch(`/api/tweet/${id}`)),
    staleTime: 60 * 60 * 1000,
  });
}
