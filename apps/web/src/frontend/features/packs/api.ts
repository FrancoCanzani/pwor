import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type Pack = {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

async function fetchPacks(workspaceId?: string): Promise<Pack[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  const query = params.size > 0 ? `?${params}` : "";
  const data = await parseJson<{ items: Pack[] }>(
    await fetch(`/api/packs${query}`),
  );
  return data.items;
}

export function packsQueryOptions(workspaceId?: string) {
  return queryOptions({
    queryKey: ["packs", "list", workspaceId ?? null] as const,
    queryFn: () => fetchPacks(workspaceId),
  });
}

async function fetchPack(id: string): Promise<Pack> {
  return parseJson<Pack>(await fetch(`/api/packs/${id}`));
}

export function packQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["packs", "detail", id] as const,
    queryFn: () => fetchPack(id),
  });
}

export async function createPack(input: {
  name: string;
  description?: string | null;
  workspaceId?: string | null;
}): Promise<Pack> {
  return parseJson<Pack>(
    await fetch("/api/packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updatePack(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    workspaceId?: string | null;
  },
): Promise<Pack> {
  return parseJson<Pack>(
    await fetch(`/api/packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deletePack(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/packs/${id}`, { method: "DELETE" }),
  );
}
