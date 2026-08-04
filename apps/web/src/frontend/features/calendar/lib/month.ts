import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
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

export function monthWeeks(cursor: Date): Date[][] {
  const days = monthGridDays(cursor);
  return Array.from({ length: 6 }, (_, week) =>
    days.slice(week * 7, week * 7 + 7),
  );
}

/** Inclusive all-day range; timed events are a single day. */
export function eventRangeDays(event: CalendarEvent): {
  start: Date;
  end: Date;
} {
  const start = startOfDay(new Date(event.startAt));
  if (!event.allDay || !event.endAt) {
    return { start, end: start };
  }
  const end = startOfDay(new Date(event.endAt));
  return end < start ? { start, end: start } : { start, end };
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

function sortEvents(bucket: CalendarEvent[]) {
  bucket.sort(
    (a, b) =>
      Number(a.allDay) - Number(b.allDay) ||
      a.startAt.localeCompare(b.startAt) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

/** Expand all-day ranges into every covered day (agenda + overflow counts). */
export function groupEventsByDay(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const { start, end } = eventRangeDays(event);
    for (
      let cursor = start;
      cursor.getTime() <= end.getTime();
      cursor = addDays(cursor, 1)
    ) {
      const key = dayKey(cursor);
      const bucket = groups.get(key);
      if (bucket) bucket.push(event);
      else groups.set(key, [event]);
    }
  }
  for (const bucket of groups.values()) sortEvents(bucket);
  return groups;
}

/** Timed (non-all-day) events only, keyed by start day. */
export function groupTimedEventsByDay(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const groups = groupBy(
    events.filter((event) => !event.allDay),
    (event) => dayKey(new Date(event.startAt)),
  );
  for (const bucket of groups.values()) sortEvents(bucket);
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

export const MAX_EVENT_LANES = 3;
export const EVENT_LANE_HEIGHT = 20;

export type WeekSpan = {
  event: CalendarEvent;
  startCol: number;
  span: number;
  lane: number;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

/** Pack all-day events into lanes for one Mon–Sun week. */
export function layoutWeekSpans(
  weekDays: Date[],
  events: CalendarEvent[],
): WeekSpan[] {
  const weekStart = startOfDay(weekDays[0]!);
  const weekEnd = startOfDay(weekDays[6]!);

  type Pending = Omit<WeekSpan, "lane">;
  const pending: Pending[] = [];

  for (const event of events) {
    if (!event.allDay) continue;
    const { start, end } = eventRangeDays(event);
    if (end < weekStart || start > weekEnd) continue;

    const segStart = start < weekStart ? weekStart : start;
    const segEnd = end > weekEnd ? weekEnd : end;
    const startCol = differenceInCalendarDays(segStart, weekStart);
    const span = differenceInCalendarDays(segEnd, segStart) + 1;

    pending.push({
      event,
      startCol,
      span,
      isRangeStart: isSameDay(segStart, start),
      isRangeEnd: isSameDay(segEnd, end),
    });
  }

  pending.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.span - a.span ||
      a.event.startAt.localeCompare(b.event.startAt) ||
      a.event.createdAt.localeCompare(b.event.createdAt),
  );

  const laneEnds: number[] = [];
  const result: WeekSpan[] = [];
  for (const segment of pending) {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane]! > segment.startCol) {
      lane += 1;
    }
    if (lane === laneEnds.length) laneEnds.push(0);
    laneEnds[lane] = segment.startCol + segment.span;
    result.push({ ...segment, lane });
  }
  return result;
}

export function resizeEventStart(
  event: CalendarEvent,
  day: Date,
): { startAt: string; endAt: string | null } {
  const { end } = eventRangeDays(event);
  let start = startOfDay(day);
  if (start > end) start = end;
  const endAt = isSameDay(start, end) ? null : dayToDefaultAt(end);
  return { startAt: dayToDefaultAt(start), endAt };
}

export function resizeEventEnd(
  event: CalendarEvent,
  day: Date,
): { startAt: string; endAt: string | null } {
  const { start } = eventRangeDays(event);
  let end = startOfDay(day);
  if (end < start) end = start;
  const endAt = isSameDay(start, end) ? null : dayToDefaultAt(end);
  return { startAt: dayToDefaultAt(start), endAt };
}
