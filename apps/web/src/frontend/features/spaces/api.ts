import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type Space = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

async function fetchSpaces(): Promise<Space[]> {
  const data = await parseJson<{ items: Space[] }>(
    await fetch("/api/spaces"),
  );
  return data.items;
}

export const spacesQueryOptions = queryOptions({
  queryKey: ["spaces", "list"] as const,
  queryFn: fetchSpaces,
});

export async function createSpace(
  name: string,
  options?: {
    description?: string | null;
  },
): Promise<Space> {
  return parseJson<Space>(
    await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: options?.description,
      }),
    }),
  );
}

export async function updateSpace(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
  },
): Promise<Space> {
  return parseJson<Space>(
    await fetch(`/api/spaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteSpace(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/spaces/${id}`, { method: "DELETE" }),
  );
}
