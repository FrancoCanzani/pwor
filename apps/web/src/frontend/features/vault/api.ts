import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type VaultItemKind = "file" | "link" | "text" | "snippet";

export type VaultParseStatus = "pending" | "ready" | "failed" | "skipped";

export type VaultItem = {
  id: string;
  kind: VaultItemKind;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  language: string | null;
  mimeType: string | null;
  url: string | null;
  siteName: string | null;
  categoryId: string | null;
  workspaceId: string | null;
  parseStatus: VaultParseStatus | null;
  /** True when a full-page site screenshot is available. */
  hasPreview?: boolean;
  sizeBytes?: number | null;
  createdAt: string;
};

export type VaultCategory = {
  id: string;
  name: string;
  position: number;
  workspaceId: string | null;
  createdAt: string;
};

export type VaultList = {
  items: VaultItem[];
  totalBytes: number;
};

async function fetchVaultItems(options?: {
  workspaceId?: string;
  inbox?: boolean;
}): Promise<VaultList> {
  const params = new URLSearchParams();
  if (options?.inbox) params.set("inbox", "1");
  else if (options?.workspaceId) params.set("workspaceId", options.workspaceId);
  const query = params.toString();
  return parseJson<VaultList>(
    await fetch(`/api/vault${query ? `?${query}` : ""}`),
  );
}

export function vaultItemsQueryOptions(workspaceId?: string) {
  return queryOptions({
    queryKey: ["vault", "items", workspaceId] as const,
    queryFn: () => fetchVaultItems({ workspaceId }),
  });
}

export function inboxItemsQueryOptions() {
  return queryOptions({
    queryKey: ["vault", "items", "inbox"] as const,
    queryFn: () => fetchVaultItems({ inbox: true }),
  });
}

export type VaultItemDetail = VaultItem & {
  content: string | null;
  extractedMarkdown: string | null;
  language: string | null;
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

async function fetchVaultCategories(
  workspaceId?: string,
): Promise<VaultCategory[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  const query = params.toString();
  const data = await parseJson<{ items: VaultCategory[] }>(
    await fetch(`/api/vault/categories${query ? `?${query}` : ""}`),
  );
  return data.items;
}

export function vaultCategoriesQueryOptions(workspaceId?: string) {
  return queryOptions({
    queryKey: ["vault", "categories", workspaceId] as const,
    queryFn: () => fetchVaultCategories(workspaceId),
  });
}

export async function createVaultCategory(
  name: string,
  workspaceId?: string | null,
): Promise<VaultCategory> {
  return parseJson<VaultCategory>(
    await fetch("/api/vault/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, workspaceId }),
    }),
  );
}

export async function renameVaultCategory(
  id: string,
  name: string,
): Promise<VaultCategory> {
  return parseJson<VaultCategory>(
    await fetch(`/api/vault/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

export async function deleteVaultCategory(id: string): Promise<{ id: string }> {
  return parseJson<{ id: string }>(
    await fetch(`/api/vault/categories/${id}`, { method: "DELETE" }),
  );
}

export async function uploadVaultItem(
  file: File,
  workspaceId?: string | null,
  categoryId?: string | null,
  options?: { title?: string | null },
): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (workspaceId) formData.append("workspaceId", workspaceId);
  if (categoryId) formData.append("categoryId", categoryId);
  if (options?.title) formData.append("title", options.title);

  return parseJson<{ id: string }>(
    await fetch("/api/vault", { method: "POST", body: formData }),
  );
}

export async function createVaultSnippet(
  content: string,
  {
    title,
    language,
    workspaceId,
    categoryId,
  }: {
    title?: string | null;
    language?: string | null;
    workspaceId?: string | null;
    categoryId?: string | null;
  } = {},
): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch("/api/vault/snippet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        title,
        language,
        workspaceId,
        categoryId,
      }),
    }),
  );
}

export async function captureVaultInput(
  input: string,
  workspaceId?: string | null,
  categoryId?: string | null,
  options?: { title?: string | null },
): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch("/api/vault/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        title: options?.title || undefined,
        workspaceId,
        categoryId,
      }),
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

export async function renameVaultItem(
  id: string,
  title: string,
): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch(`/api/vault/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  );
}

export async function updateVaultItemCategory(
  id: string,
  categoryId: string | null,
): Promise<VaultItem> {
  return parseJson<VaultItem>(
    await fetch(`/api/vault/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    }),
  );
}

export async function updateVaultItem(
  id: string,
  patch: {
    title?: string | null;
    content?: string;
    language?: string | null;
    workspaceId?: string | null;
    categoryId?: string | null;
  },
): Promise<VaultItemDetail> {
  return parseJson<VaultItemDetail>(
    await fetch(`/api/vault/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}
