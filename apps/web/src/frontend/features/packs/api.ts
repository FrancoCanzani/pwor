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

export type SourceParseStatus = "pending" | "ready" | "failed" | "skipped";

export type PackSource = {
  id: string;
  type: "file" | "text" | "url";
  title: string | null;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  hash: string | null;
  sourceUrl: string | null;
  parseStatus: SourceParseStatus;
  parseError: string | null;
  parsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  addedAt: string;
};

export type PackSourceDetail = PackSource & {
  content: string | null;
  extractedMarkdown: string | null;
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

async function fetchPackSources(packId: string): Promise<PackSource[]> {
  const data = await parseJson<{ items: PackSource[] }>(
    await fetch(`/api/packs/${packId}/sources`),
  );
  return data.items;
}

export function packSourcesQueryOptions(packId: string) {
  return queryOptions({
    queryKey: ["packs", "sources", packId] as const,
    queryFn: () => fetchPackSources(packId),
  });
}

async function fetchPackSource(
  packId: string,
  sourceId: string,
): Promise<PackSourceDetail> {
  return parseJson<PackSourceDetail>(
    await fetch(`/api/packs/${packId}/sources/${sourceId}`),
  );
}

export function packSourceQueryOptions(packId: string, sourceId: string) {
  return queryOptions({
    queryKey: ["packs", "sources", packId, sourceId] as const,
    queryFn: () => fetchPackSource(packId, sourceId),
  });
}

export async function uploadPackSource(
  packId: string,
  file: File,
): Promise<PackSource> {
  const body = new FormData();
  body.set("file", file);
  return parseJson<PackSource>(
    await fetch(`/api/packs/${packId}/sources`, {
      method: "POST",
      body,
    }),
  );
}

export async function createPackTextSource(
  packId: string,
  input: { content: string; title?: string },
): Promise<PackSource> {
  return parseJson<PackSource>(
    await fetch(`/api/packs/${packId}/sources/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function createPackUrlSource(
  packId: string,
  input: { url: string; title?: string },
): Promise<PackSource> {
  return parseJson<PackSource>(
    await fetch(`/api/packs/${packId}/sources/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function deletePackSource(
  packId: string,
  sourceId: string,
): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/packs/${packId}/sources/${sourceId}`, {
      method: "DELETE",
    }),
  );
}
