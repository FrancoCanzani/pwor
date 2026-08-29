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

export function mcpConnectPrompt(url: string, key: string): string {
  const config = mcpCursorConfig(url, key);
  return `Connect Pwor as a remote MCP server. Pwor is my personal memory — pages, files, and notes I’ve saved. Not a chat. Use it when I ask about something I might have saved, and save things back when I tell you to remember them.

Add this MCP server:

Name: pwor
URL: ${url}
Transport: streamable HTTP (remote)
Authorization: Bearer ${key}

${config}

Once connected:
- Start with search. Hits have kind item or note — open them with get_item or get_note.
- capture saves a URL or text. create_note writes a note. list_spaces lists folders. Inbox is unfiled.
- You can search, open, and save. You cannot delete anything.`;
}
