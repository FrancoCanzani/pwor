import { Link } from "@tanstack/react-router";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Task } from "@features/tasks/api";
import { dueDateInfo } from "@features/tasks/lib/due-date";

function TaskTitle({ task }: { task: Task }) {
  const className = cn(
    "text-sm",
    task.status === "done" && "text-muted-foreground line-through",
  );

  if (task.sourceType === "note" && task.sourceId) {
    return (
      <Link
        to="/notes/$noteId"
        params={{ noteId: task.sourceId }}
        className={className}
      >
        {task.title}
      </Link>
    );
  }

  if (task.sourceType === "vault_item" && task.sourceId) {
    return (
      <Link to="/vault" className={className}>
        {task.title}
      </Link>
    );
  }

  return <span className={className}>{task.title}</span>;
}

export function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (done: boolean) => void;
}) {
  const due = dueDateInfo(task.dueAt);

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={task.status === "done"}
          onCheckedChange={(checked) => onToggle(checked === true)}
          className="rounded-none"
        />
        <TaskTitle task={task} />
      </div>

      {due.group !== "no-date" ? (
        <span
          className={cn(
            "text-xs tabular-nums text-muted-foreground",
            due.overdue && "text-destructive",
          )}
        >
          {due.label}
        </span>
      ) : null}
    </li>
  );
}
