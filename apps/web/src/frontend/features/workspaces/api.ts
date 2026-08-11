import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  shader?: string | null;
  createdAt: string;
  updatedAt: string;
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

export async function createWorkspace(
  name: string,
  options?: {
    description?: string | null;
    shader?: string;
  },
): Promise<Workspace> {
  return parseJson<Workspace>(
    await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: options?.description,
        shader: options?.shader,
      }),
    }),
  );
}

export async function updateWorkspace(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    shader?: string;
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
