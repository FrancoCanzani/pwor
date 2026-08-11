import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { authClient } from "@lib/auth-client";

export const sessionQueryOptions = queryOptions({
  queryKey: ["session"] as const,
  queryFn: async () => {
    const { data } = await authClient.getSession();
    return data;
  },
  staleTime: 60_000,
});

export async function refreshSession(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: sessionQueryOptions.queryKey });
  queryClient.removeQueries({ queryKey: sessionQueryOptions.queryKey });
  return queryClient.fetchQuery(sessionQueryOptions);
}
