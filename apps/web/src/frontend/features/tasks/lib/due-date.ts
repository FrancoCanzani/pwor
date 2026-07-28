export type DateGroup = "overdue" | "today" | "tomorrow" | "upcoming" | "no-date";

export type DueDateInfo = {
  group: DateGroup;
  label: string;
  overdue: boolean;
};

export function dueDateInfo(dueAt: string | null): DueDateInfo {
  if (!dueAt) return { group: "no-date", label: "", overdue: false };

  const diffDays = Math.round(
    (new Date(dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays < 0) {
    return { group: "overdue", label: "overdue", overdue: true };
  }
  if (diffDays === 0) {
    return { group: "today", label: "today", overdue: false };
  }
  if (diffDays === 1) {
    return { group: "tomorrow", label: "tomorrow", overdue: false };
  }
  return { group: "upcoming", label: `in ${diffDays} days`, overdue: false };
}
