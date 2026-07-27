import { queryOptions } from "@tanstack/react-query";

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
  const res = await fetch("/api/vault");
  if (!res.ok) throw new Error("Failed to load vault items");
  const data = (await res.json()) as { items: VaultItem[] };
  return data.items;
}

export const vaultItemsQueryOptions = queryOptions({
  queryKey: ["vault", "items"] as const,
  queryFn: fetchVaultItems,
});

export async function uploadVaultItem(file: File): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/vault", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
  return (await res.json()) as { id: string };
}

export async function retryVaultItem(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/vault/${id}/retry`, { method: "POST" });
  if (!res.ok) throw new Error("Retry failed");
  return (await res.json()) as { id: string };
}
