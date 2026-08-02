import {
  ArchiveIcon,
  CheckCircledIcon,
  CircleIcon,
} from "@radix-ui/react-icons";
import type { ComponentType } from "react";

import type { Task, TaskStatus } from "@features/tasks/api";

export const TASK_STATUSES: TaskStatus[] = ["open", "done", "dismissed"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Active",
  done: "Done",
  dismissed: "Archived",
};

export const TASK_STATUS_ICON: Record<
  TaskStatus,
  ComponentType<{ className?: string }>
> = {
  open: CircleIcon,
  done: CheckCircledIcon,
  dismissed: ArchiveIcon,
};

export const TASK_STATUS_ICON_COLOR: Record<TaskStatus, string> = {
  open: "text-amber-500",
  done: "text-emerald-500",
  dismissed: "text-muted-foreground",
};

export function groupTasksByStatus(
  tasks: Task[],
): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    open: [],
    done: [],
    dismissed: [],
  };

  for (const task of tasks) {
    groups[task.status].push(task);
  }

  for (const status of TASK_STATUSES) {
    groups[status].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return groups;
}
