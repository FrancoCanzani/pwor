import { CheckIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import type { CalendarEvent } from "@features/calendar/api";
import {
  buildAgenda,
  eventTimeLabel,
  type AgendaGroup,
} from "@features/calendar/lib/month";
import type { Task } from "@features/tasks/api";

function EventRow({
  event,
  onEdit,
}: {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
}) {
  const time = eventTimeLabel(event);
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2.5 transition-colors hover:border-ring/60"
      onDoubleClick={() => onEdit(event)}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
      <span className="min-w-0 flex-1 truncate text-sm leading-snug">
        {event.title}
      </span>
      <span className="shrink-0 text-xs font-nums text-muted-foreground">
        {time ?? "all day"}
      </span>
    </div>
  );
}

function TaskRow({
  task,
  showDate,
  onToggle,
  onEdit,
}: {
  task: Task;
  showDate: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const done = task.status === "done";
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2.5 transition-colors hover:border-ring/60">
      <button
        type="button"
        aria-label={done ? "Mark task open" : "Mark task done"}
        onClick={() => onToggle(task)}
        className={cn(
          "grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-ring/70 text-transparent transition-colors",
          done && "border-foreground bg-foreground text-background",
        )}
      >
        <CheckIcon className="size-2.5" />
      </button>
      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm leading-snug",
          done && "text-muted-foreground line-through",
          task.status === "dismissed" && "text-muted-foreground",
        )}
        onDoubleClick={() => onEdit(task)}
      >
        {task.title}
      </button>
      {showDate && task.dueAt ? (
        <span className="shrink-0 text-xs font-nums text-destructive">
          {format(new Date(task.dueAt), "EEE d MMM")}
        </span>
      ) : null}
    </div>
  );
}

function GroupSection({
  group,
  onToggleTask,
  onEditTask,
  onEditEvent,
}: {
  group: AgendaGroup;
  onToggleTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-0.5">
        <h2
          className={cn(
            "text-xs font-normal",
            group.isOverdue && "text-destructive",
            group.isToday &&
              "rounded-[5px] bg-foreground px-1.5 py-0.5 text-background",
          )}
        >
          {group.label}
        </h2>
        {group.relative ? (
          <span className="text-[11px] text-muted-foreground">
            {group.relative}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        {group.events.map((event) => (
          <EventRow key={event.id} event={event} onEdit={onEditEvent} />
        ))}
        {group.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            showDate={group.isOverdue}
            onToggle={onToggleTask}
            onEdit={onEditTask}
          />
        ))}
      </div>
    </section>
  );
}

export function AgendaList({
  events,
  tasks,
  onToggleTask,
  onEditTask,
  onEditEvent,
}: {
  events: CalendarEvent[];
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  const groups = buildAgenda(events, tasks);

  if (groups.length === 0) {
    return (
      <PageEmpty
        title="Nothing scheduled"
        description="Add an event, or give a task a due date."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10">
      {groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          onToggleTask={onToggleTask}
          onEditTask={onEditTask}
          onEditEvent={onEditEvent}
        />
      ))}
    </div>
  );
}
