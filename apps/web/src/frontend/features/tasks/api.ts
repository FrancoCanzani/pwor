import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type TaskStatus = "open" | "done" | "dismissed";
export type TaskSourceType = "vault_item" | "note";

export type Task = {
  id: string;
  title: string;
  dueAt: string | null;
  status: TaskStatus;
  sourceType: TaskSourceType | null;
  sourceId: string | null;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListFilter = "open" | "all";

async function fetchTasks(
  filter: TaskListFilter,
  workspaceId?: string,
): Promise<Task[]> {
  const params = new URLSearchParams({ status: filter });
  if (workspaceId) params.set("workspaceId", workspaceId);
  const data = await parseJson<{ items: Task[] }>(
    await fetch(`/api/tasks?${params.toString()}`),
  );
  return data.items;
}

export function tasksQueryOptions(
  filter: TaskListFilter = "all",
  workspaceId?: string,
) {
  return queryOptions({
    queryKey: ["tasks", "list", filter, workspaceId] as const,
    queryFn: () => fetchTasks(filter, workspaceId),
  });
}

export async function createTask(
  title: string,
  dueAt?: string | null,
  workspaceId?: string | null,
): Promise<Task> {
  return parseJson<Task>(
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueAt, workspaceId }),
    }),
  );
}

export async function updateTask(
  id: string,
  patch: {
    title?: string;
    dueAt?: string | null;
    status?: TaskStatus;
    workspaceId?: string | null;
  },
): Promise<Task> {
  return parseJson<Task>(
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteTask(id: string): Promise<void> {
  await parseJson<unknown>(
    await fetch(`/api/tasks/${id}`, { method: "DELETE" }),
  );
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  return updateTask(id, { status });
}

export async function updateTaskProject(
  id: string,
  workspaceId: string | null,
): Promise<Task> {
  return updateTask(id, { workspaceId });
}
