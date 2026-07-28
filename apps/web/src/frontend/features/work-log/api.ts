import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type WorkLogAuthor = {
  name: string;
  email: string;
  image: string | null;
};

export type WorkLogSource = {
  type: "task" | "note";
  id: string;
  title: string;
  at: string;
};

export type WorkLogListItem = {
  id: string;
  day: string;
  body: string;
  draftedAt: string | Date | null;
  sourceTaskCount: number;
  sourceNoteCount: number;
  updatedAt: string | Date;
  createdAt: string | Date;
  author: WorkLogAuthor;
};

export type WorkLog = WorkLogListItem & {
  userId: string;
  sources: WorkLogSource[] | null;
};

async function fetchWorkLogs(): Promise<WorkLogListItem[]> {
  const data = await parseJson<{ items: WorkLogListItem[] }>(
    await fetch("/api/work-log"),
  );
  return data.items;
}

export const workLogsQueryOptions = queryOptions({
  queryKey: ["work-log", "list"] as const,
  queryFn: fetchWorkLogs,
});

export async function createWorkLog(body: string, day?: string): Promise<WorkLog> {
  return parseJson<WorkLog>(
    await fetch("/api/work-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(day ? { body, day } : { body }),
    }),
  );
}

export async function draftWorkLog(day?: string): Promise<WorkLog> {
  return parseJson<WorkLog>(
    await fetch("/api/work-log/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(day ? { day } : {}),
    }),
  );
}

export async function updateWorkLog(
  id: string,
  patch: { body: string },
): Promise<WorkLog> {
  return parseJson<WorkLog>(
    await fetch(`/api/work-log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteWorkLog(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/work-log/${id}`, { method: "DELETE" }),
  );
}
