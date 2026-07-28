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
  createdAt: string;
};

export type TaskListFilter = "open" | "all";

async function fetchTasks(filter: TaskListFilter): Promise<Task[]> {
  const data = await parseJson<{ items: Task[] }>(
    await fetch(`/api/tasks?status=${filter}`),
  );
  return data.items;
}

export function tasksQueryOptions(filter: TaskListFilter = "open") {
  return queryOptions({
    queryKey: ["tasks", "list", filter] as const,
    queryFn: () => fetchTasks(filter),
  });
}

export async function createTask(
  title: string,
  dueAt?: string | null,
): Promise<Task> {
  return parseJson<Task>(
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueAt }),
    }),
  );
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  return parseJson<Task>(
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}
