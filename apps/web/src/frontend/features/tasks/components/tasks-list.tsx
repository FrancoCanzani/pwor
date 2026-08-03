import { ClockIcon } from "@radix-ui/react-icons";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import type { Task, TaskStatus } from "@features/tasks/api";
import { DragChip } from "@features/tasks/components/drag-chip";
import type { TaskMove } from "@features/tasks/lib/dnd";
import { dueDateInfo } from "@features/tasks/lib/due-date";
import { useRelativeTime } from "@features/tasks/lib/relative-time";
import {
  TASK_STATUSES,
  TASK_STATUS_ICON,
  TASK_STATUS_ICON_COLOR,
  TASK_STATUS_LABEL,
  groupTasksByStatus,
} from "@features/tasks/lib/status";
import {
  useTaskCardDnd,
  useTaskColumnDnd,
  useTaskDropMonitor,
} from "@features/tasks/lib/use-task-dnd";

function ListRowContent({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const age = useRelativeTime(task.updatedAt);
  const due = dueDateInfo(task.dueAt);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm font-normal leading-snug",
          task.status === "done" && "text-muted-foreground line-through",
          task.status === "dismissed" && "text-muted-foreground",
        )}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onEdit(task);
        }}
      >
        {task.title}
      </button>
      {due.group !== "no-date" ? (
        <div
          className={cn(
            "hidden shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:flex",
            due.overdue && "bg-destructive/10 text-destructive",
          )}
        >
          <ClockIcon className="size-3" />
          <span>{due.label}</span>
        </div>
      ) : null}
      {age ? (
        <span className="shrink-0 text-xs font-nums text-muted-foreground">
          {age}
        </span>
      ) : null}
    </div>
  );
}

function ListRow({
  task,
  status,
  index,
  onEdit,
}: {
  task: Task;
  status: TaskStatus;
  index: number;
  onEdit: (task: Task) => void;
}) {
  const { outerRef, innerRef, dragging, preview } = useTaskCardDnd(
    task.id,
    status,
    index,
  );

  return (
    <li ref={outerRef} className="relative list-none">
      <div
        ref={innerRef}
        className={cn(
          "flex cursor-grab touch-none items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2.5 transition-colors active:cursor-grabbing active:border-foreground/30",
          dragging && "opacity-30",
        )}
      >
        <ListRowContent task={task} onEdit={onEdit} />
      </div>
      {preview ? createPortal(<DragChip title={task.title} />, preview) : null}
    </li>
  );
}

function StatusSection({
  status,
  tasks,
  onEdit,
}: {
  status: TaskStatus;
  tasks: Task[];
  onEdit: (task: Task) => void;
}) {
  const { columnRef, isOver } = useTaskColumnDnd<HTMLElement, HTMLElement>(
    status,
  );
  const Icon = TASK_STATUS_ICON[status];

  return (
    <section
      ref={columnRef}
      className={cn(
        "flex flex-col rounded-xl border border-border/60 bg-muted/40 transition-colors",
        isOver && "bg-muted/70",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("size-3.5", TASK_STATUS_ICON_COLOR[status])} />
          <h2 className="text-sm font-normal text-foreground">
            {TASK_STATUS_LABEL[status]}
          </h2>
        </div>
        <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] font-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <ul className="flex min-h-16 flex-1 flex-col gap-2 px-2 pb-3">
        {tasks.length > 0 ? (
          tasks.map((task, index) => (
            <ListRow
              key={task.id}
              task={task}
              status={status}
              index={index}
              onEdit={onEdit}
            />
          ))
        ) : (
          <li className="list-none px-1 py-4 text-center text-xs text-muted-foreground">
            Nothing here
          </li>
        )}
      </ul>
    </section>
  );
}

export function TasksList({
  tasks,
  onMove,
  onEdit,
}: {
  tasks: Task[];
  onMove: (move: TaskMove) => void;
  onEdit: (task: Task) => void;
}) {
  const grouped = groupTasksByStatus(tasks);
  useTaskDropMonitor(grouped, onMove);

  if (tasks.length === 0) {
    return (
      <PageEmpty
        title="Nothing to do"
        description="Add a task, or wait for one to show up from something you capture."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
      {TASK_STATUSES.map((status) => (
        <StatusSection
          key={status}
          status={status}
          tasks={grouped[status]}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
