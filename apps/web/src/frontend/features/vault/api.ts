import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type VaultItemKind = "file" | "text";

export type VaultItem = {
  id: string;
  kind: VaultItemKind;
  title: string | null;
  mimeType: string | null;
  workspaceId: string | null;
  createdAt: string;
};

export type VaultList = {
  items: VaultItem[];
  totalBytes: number;
};

async function fetchVaultItems(workspaceId?: string): Promise<VaultList> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  const query = params.toString();
  return parseJson<VaultList>(
    await fetch(`/api/vault${query ? `?${query}` : ""}`),
  );
}

export function vaultItemsQueryOptions(workspaceId?: string) {
  return queryOptions({
    queryKey: ["vault", "items", workspaceId] as const,
    queryFn: () => fetchVaultItems(workspaceId),
  });
}

export type VaultItemDetail = VaultItem & {
  content: string | null;
};

async function fetchVaultItem(id: string): Promise<VaultItemDetail> {
  return parseJson<VaultItemDetail>(await fetch(`/api/vault/${id}`));
}

export function vaultItemQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["vault", "items", id] as const,
    queryFn: () => fetchVaultItem(id),
  });
}

async function fetchVaultFileText(id: string): Promise<string> {
  const res = await fetch(`/api/vault/${id}/file`);
  if (!res.ok) {
    throw new Error("Failed to load file");
  }
  return res.text();
}

export function vaultFileTextQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["vault", "file-text", id] as const,
    queryFn: () => fetchVaultFileText(id),
  });
}

async function fetchVaultSheet(id: string) {
  const res = await fetch(`/api/vault/${id}/file`);
  if (!res.ok) {
    throw new Error("Failed to load file");
  }
  const buffer = await res.arrayBuffer();
  const { parseSheetWorkbook } = await import("@features/vault/lib/sheet");
  return parseSheetWorkbook(buffer);
}

export function vaultSheetQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["vault", "sheet", id] as const,
    queryFn: () => fetchVaultSheet(id),
  });
}

export async function uploadVaultItem(
  file: File,
  workspaceId?: string | null,
): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (workspaceId) formData.append("workspaceId", workspaceId);

  return parseJson<{ id: string }>(
    await fetch("/api/vault", { method: "POST", body: formData }),
  );
}

export async function createVaultText(
  content: string,
  workspaceId?: string | null,
): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch("/api/vault/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, workspaceId }),
    }),
  );
}

export async function deleteVaultItem(id: string): Promise<{ id: string }> {
  return parseJson<{ id: string }>(
    await fetch(`/api/vault/${id}`, { method: "DELETE" }),
  );
}

export async function updateVaultItemProject(
  id: string,
  workspaceId: string | null,
): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch(`/api/vault/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }),
  );
}
