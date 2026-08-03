import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
};

async function fetchEvents(workspaceId?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  const data = await parseJson<{ items: CalendarEvent[] }>(
    await fetch(`/api/events?${params.toString()}`),
  );
  return data.items;
}

export function eventsQueryOptions(workspaceId?: string) {
  return queryOptions({
    queryKey: ["events", "list", workspaceId] as const,
    queryFn: () => fetchEvents(workspaceId),
  });
}

export async function createEvent(input: {
  title: string;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  workspaceId?: string | null;
}): Promise<CalendarEvent> {
  return parseJson<CalendarEvent>(
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateEvent(
  id: string,
  patch: {
    title?: string;
    startAt?: string;
    endAt?: string | null;
    allDay?: boolean;
    workspaceId?: string | null;
  },
): Promise<CalendarEvent> {
  return parseJson<CalendarEvent>(
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteEvent(id: string): Promise<void> {
  await parseJson<unknown>(
    await fetch(`/api/events/${id}`, { method: "DELETE" }),
  );
}
