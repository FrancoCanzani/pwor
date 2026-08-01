import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import type { NoteListItem } from "@features/notes/api";
import type { Task } from "@features/tasks/api";
import type { VaultItem } from "@features/vault/api";

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInbox = {
  id: string;
  workspaceId: string;
  token: string;
  label: string | null;
  createdAt: string;
};

export type WorkspaceDetail = Workspace & {
  tasks: Task[];
  notes: NoteListItem[];
  vaultItems: VaultItem[];
  inboxes: WorkspaceInbox[];
};

async function fetchWorkspaces(): Promise<Workspace[]> {
  const data = await parseJson<{ items: Workspace[] }>(
    await fetch("/api/workspaces"),
  );
  return data.items;
}

export const workspacesQueryOptions = queryOptions({
  queryKey: ["workspaces", "list"] as const,
  queryFn: fetchWorkspaces,
});

async function fetchWorkspace(id: string): Promise<WorkspaceDetail> {
  return parseJson<WorkspaceDetail>(await fetch(`/api/workspaces/${id}`));
}

export function workspaceQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["workspaces", "detail", id] as const,
    queryFn: () => fetchWorkspace(id),
  });
}

export async function createWorkspace(
  name: string,
  description?: string | null,
): Promise<Workspace> {
  return parseJson<Workspace>(
    await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    }),
  );
}

export async function updateWorkspace(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
  },
): Promise<Workspace> {
  return parseJson<Workspace>(
    await fetch(`/api/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteWorkspace(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" }),
  );
}

export async function createWorkspaceInbox(
  workspaceId: string,
  label?: string | null,
): Promise<WorkspaceInbox> {
  return parseJson<WorkspaceInbox>(
    await fetch(`/api/workspaces/${workspaceId}/inboxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }),
  );
}

export async function deleteWorkspaceInbox(
  workspaceId: string,
  inboxId: string,
): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/workspaces/${workspaceId}/inboxes/${inboxId}`, {
      method: "DELETE",
    }),
  );
}
