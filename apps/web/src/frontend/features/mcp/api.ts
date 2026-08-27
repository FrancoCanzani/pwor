import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type McpKey = {
  id: string;
  name: string;
  start: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

export type CreatedMcpKey = {
  id: string;
  name: string;
  key: string;
  start: string | null;
};

async function listMcpKeys(): Promise<McpKey[]> {
  const body = await parseJson<{ items: McpKey[] }>(
    await fetch("/api/mcp/keys"),
  );
  return body.items;
}

export function mcpKeysQueryOptions() {
  return queryOptions({
    queryKey: ["mcp-keys"] as const,
    queryFn: listMcpKeys,
  });
}

export async function createMcpKey(name?: string): Promise<CreatedMcpKey> {
  return parseJson<CreatedMcpKey>(
    await fetch("/api/mcp/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(name ? { name } : {}),
    }),
  );
}

export async function revokeMcpKey(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/mcp/keys/${id}`, { method: "DELETE" }),
  );
}

export function mcpUrl(): string {
  return `${window.location.origin}/mcp`;
}

export function mcpCursorConfig(url: string, key: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        pwor: {
          url,
          headers: {
            Authorization: `Bearer ${key}`,
          },
        },
      },
    },
    null,
    2,
  );
}
