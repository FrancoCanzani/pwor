import { Link, useParams } from "@tanstack/react-router";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Task } from "@features/tasks/api";
import { dueDateInfo } from "@features/tasks/lib/due-date";
import { relativeTime } from "@features/tasks/lib/relative-time";
import { cue } from "@lib/sound";

function TaskTitle({ task }: { task: Task }) {
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const className = cn(
    "truncate text-sm font-normal",
    task.status === "done" && "text-muted-foreground line-through",
    task.status === "dismissed" && "text-muted-foreground",
  );

  if (task.sourceType === "note" && task.sourceId) {
    return (
      <Link
        to="/$workspaceId/notes/$noteId"
        params={{ workspaceId, noteId: task.sourceId }}
        className={className}
      >
        {task.title}
      </Link>
    );
  }

  if (task.sourceType === "vault_item" && task.sourceId) {
    return (
      <Link
        to="/$workspaceId/vault"
        params={{ workspaceId }}
        className={className}
      >
        {task.title}
      </Link>
    );
  }

  return <span className={className}>{task.title}</span>;
}

export function TaskRow({
  task,
  onToggle,
  className,
}: {
  task: Task;
  onToggle?: (done: boolean) => void;
  className?: string;
}) {
  const due = dueDateInfo(task.dueAt);
  const age = relativeTime(task.updatedAt);
  const showCheckbox = onToggle != null && task.status !== "dismissed";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showCheckbox ? (
          <Checkbox
            checked={task.status === "done"}
            onCheckedChange={(checked) => {
              cue("toggle");
              onToggle(checked === true);
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : null}
        <TaskTitle task={task} />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {due.group !== "no-date" ? (
          <span
            className={cn(
              "text-xs font-nums text-muted-foreground",
              due.overdue && "text-destructive",
            )}
          >
            {due.label}
          </span>
        ) : null}
        {age ? (
          <span className="text-xs font-nums text-muted-foreground">
            {age}
          </span>
        ) : null}
      </div>
    </div>
  );
}
