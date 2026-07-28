function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateOnly(iso: string): Date {
  const [yText, mText, dText] = iso.split("-");
  const y = Number(yText);
  const m = Number(mText);
  const d = Number(dText);
  return new Date(y, m - 1, d);
}

/** YYYY-MM-DD in the local timezone. */
export function localToday(now = new Date()): string {
  return toDateOnly(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  );
}

export function formatDay(day: string): string {
  return parseDateOnly(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isToday(day: string, now = new Date()): boolean {
  return day === localToday(now);
}
