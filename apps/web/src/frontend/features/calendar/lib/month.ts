import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { CalendarEvent } from "@features/calendar/api";
import type { Task } from "@features/tasks/api";

export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Always 6 rows, so the grid height doesn't jump between months. */
export function monthGridDays(cursor: Date): Date[] {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function groupBy<T>(items: T[], toKey: (item: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = toKey(item);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

export function groupEventsByDay(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const groups = groupBy(events, (e) => dayKey(new Date(e.startAt)));
  for (const bucket of groups.values()) {
    bucket.sort(
      (a, b) =>
        Number(a.allDay) - Number(b.allDay) ||
        a.startAt.localeCompare(b.startAt) ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }
  return groups;
}

export function groupTasksByDay(tasks: Task[]): Map<string, Task[]> {
  const groups = groupBy(tasks, (t) =>
    t.dueAt ? dayKey(new Date(t.dueAt)) : null,
  );
  for (const bucket of groups.values()) {
    bucket.sort(
      (a, b) =>
        (a.dueAt ?? "").localeCompare(b.dueAt ?? "") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }
  return groups;
}

export function eventTimeLabel(event: CalendarEvent): string | null {
  return event.allDay ? null : format(new Date(event.startAt), "HH:mm");
}

export type AgendaGroup = {
  key: string;
  label: string;
  relative: string;
  isToday: boolean;
  isOverdue: boolean;
  events: CalendarEvent[];
  tasks: Task[];
};

export const AGENDA_DAYS_AHEAD = 14;

export function buildAgenda(
  events: CalendarEvent[],
  tasks: Task[],
): AgendaGroup[] {
  const today = startOfDay(new Date());
  const groups: AgendaGroup[] = [];

  const overdue = tasks
    .filter(
      (task) =>
        task.dueAt != null &&
        task.status === "open" &&
        differenceInCalendarDays(new Date(task.dueAt), today) < 0,
    )
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  if (overdue.length > 0) {
    groups.push({
      key: "overdue",
      label: "Overdue",
      relative: "",
      isToday: false,
      isOverdue: true,
      events: [],
      tasks: overdue,
    });
  }

  const eventsByDay = groupEventsByDay(events);
  const tasksByDay = groupTasksByDay(tasks);
  for (let offset = 0; offset <= AGENDA_DAYS_AHEAD; offset++) {
    const date = addDays(today, offset);
    const key = dayKey(date);
    const dayEvents = eventsByDay.get(key) ?? [];
    const dayTasks = tasksByDay.get(key) ?? [];
    if (dayEvents.length === 0 && dayTasks.length === 0) continue;
    groups.push({
      key,
      label: format(date, "EEE d MMM"),
      relative:
        offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : `in ${offset} days`,
      isToday: isToday(date),
      isOverdue: false,
      events: dayEvents,
      tasks: dayTasks,
    });
  }

  return groups;
}

export function rescheduleToDay(at: string, day: Date): Date {
  const previous = new Date(at);
  const next = new Date(day);
  next.setHours(
    previous.getHours(),
    previous.getMinutes(),
    previous.getSeconds(),
    previous.getMilliseconds(),
  );
  return next;
}

/** Noon, so the entry stays on the intended day across timezone shifts. */
export function dayToDefaultAt(day: Date): string {
  const at = new Date(day);
  at.setHours(12, 0, 0, 0);
  return at.toISOString();
}
