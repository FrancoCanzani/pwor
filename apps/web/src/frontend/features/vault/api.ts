import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type VaultItemStatus = "uploaded" | "processing" | "ready" | "failed";

export type VaultDocumentType =
  | "passport"
  | "id"
  | "contract"
  | "insurance"
  | "other";

export type VaultItem = {
  id: string;
  status: VaultItemStatus;
  type: VaultDocumentType | null;
  title: string | null;
  mimeType: string;
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

export async function uploadVaultItem(file: File): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("file", file);

  return parseJson<{ id: string }>(
    await fetch("/api/vault", { method: "POST", body: formData }),
  );
}

export async function retryVaultItem(id: string): Promise<{ id: string }> {
  return parseJson<{ id: string }>(
    await fetch(`/api/vault/${id}/retry`, { method: "POST" }),
  );
}
