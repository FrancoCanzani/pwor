export const CALENDAR_DND = Symbol("calendar-dnd");

export type CalendarChipData = {
  type: "calendar-chip";
  kind: "event" | "task";
  id: string;
  at: string;
  instanceId: typeof CALENDAR_DND;
};

export type CalendarDayData = {
  type: "calendar-day";
  dayKey: string;
  instanceId: typeof CALENDAR_DND;
};

export function isCalendarChipData(
  data: Record<string | symbol, unknown>,
): data is CalendarChipData {
  return data.type === "calendar-chip" && data.instanceId === CALENDAR_DND;
}

export function isCalendarDayData(
  data: Record<string | symbol, unknown>,
): data is CalendarDayData {
  return data.type === "calendar-day" && data.instanceId === CALENDAR_DND;
}
