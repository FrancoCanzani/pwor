import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import type { Task } from "@features/tasks/api";

export type InboxItem = {
  id: string;
  workspaceId: string | null;
  fromAddress: string;
  subject: string | null;
  body: string;
  createdAt: string;
};

async function fetchInboxItems(workspaceId?: string): Promise<InboxItem[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  const query = params.toString();
  const data = await parseJson<{ items: InboxItem[] }>(
    await fetch(`/api/inbox${query ? `?${query}` : ""}`),
  );
  return data.items;
}

export function inboxItemsQueryOptions(workspaceId?: string) {
  return queryOptions({
    queryKey: ["inbox", "list", workspaceId] as const,
    queryFn: () => fetchInboxItems(workspaceId),
  });
}

export async function deleteInboxItem(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/inbox/${id}`, { method: "DELETE" }),
  );
}

export async function generateTaskFromInbox(id: string): Promise<Task> {
  return parseJson<Task>(
    await fetch(`/api/inbox/${id}/generate-task`, { method: "POST" }),
  );
}

export async function simulateInboundEmail(workspaceId: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch("/api/inbox/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }),
  );
}
