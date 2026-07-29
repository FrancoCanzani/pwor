import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type VaultItemStatus = "uploaded" | "processing" | "ready" | "failed";
export type VaultItemKind = "file" | "link" | "text";

export type VaultDocumentType =
  | "passport"
  | "id"
  | "contract"
  | "insurance"
  | "other";

export type VaultItem = {
  id: string;
  status: VaultItemStatus;
  kind: VaultItemKind;
  type: VaultDocumentType | null;
  title: string | null;
  mimeType: string | null;
  url: string | null;
  siteName: string | null;
  error: string | null;
  createdAt: string;
};

async function fetchVaultItems(): Promise<VaultItem[]> {
  const data = await parseJson<{ items: VaultItem[] }>(
    await fetch("/api/vault"),
  );
  return data.items;
}

export const vaultItemsQueryOptions = queryOptions({
  queryKey: ["vault", "items"] as const,
  queryFn: fetchVaultItems,
});

export type VaultItemDetail = VaultItem & {
  ocrText: string | null;
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

export async function uploadVaultItem(file: File): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("file", file);

  return parseJson<{ id: string }>(
    await fetch("/api/vault", { method: "POST", body: formData }),
  );
}

export async function createVaultLink(url: string): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch("/api/vault/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
}

export async function createVaultText(content: string): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch("/api/vault/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
  );
}

export async function retryVaultItem(id: string): Promise<{ id: string }> {
  return parseJson<{ id: string }>(
    await fetch(`/api/vault/${id}/retry`, { method: "POST" }),
  );
}

export async function deleteVaultItem(id: string): Promise<{ id: string }> {
  return parseJson<{ id: string }>(
    await fetch(`/api/vault/${id}`, { method: "DELETE" }),
  );
}
