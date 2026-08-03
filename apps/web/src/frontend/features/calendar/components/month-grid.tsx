import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { PlusIcon } from "@radix-ui/react-icons";
import { isSameMonth, isToday } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@features/calendar/api";
import {
  CALENDAR_DND,
  isCalendarChipData,
  isCalendarDayData,
  type CalendarChipData,
} from "@features/calendar/lib/dnd";
import {
  dayKey,
  eventTimeLabel,
  groupEventsByDay,
  groupTasksByDay,
  monthGridDays,
} from "@features/calendar/lib/month";
import type { Task } from "@features/tasks/api";
import { DragChip } from "@features/tasks/components/drag-chip";
import { dueDateInfo } from "@features/tasks/lib/due-date";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

function Chip({
  kind,
  id,
  at,
  title,
  className,
  time,
  onEdit,
}: {
  kind: "event" | "task";
  id: string;
  at: string;
  title: string;
  className: string;
  time?: string | null;
  onEdit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return draggable({
      element,
      getInitialData: (): CalendarChipData => ({
        type: "calendar-chip",
        kind,
        id,
        at,
        instanceId: CALENDAR_DND,
      }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: 16, y: 16 }),
          render({ container }) {
            setPreview(container);
            return () => setPreview(null);
          },
        });
      },
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [kind, id, at]);

  return (
    <>
      <div
        ref={ref}
        title={title}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className={cn(
          "cursor-grab touch-none truncate rounded-md px-1.5 py-0.5 text-[11px] leading-snug active:cursor-grabbing",
          className,
          dragging && "opacity-30",
        )}
      >
        {time ? (
          <span className="mr-1 font-nums opacity-70">{time}</span>
        ) : null}
        {title}
      </div>
      {preview ? createPortal(<DragChip title={title} />, preview) : null}
    </>
  );
}

function DayCell({
  date,
  day,
  cursor,
  events,
  tasks,
  onQuickAdd,
  onEditEvent,
  onEditTask,
}: {
  date: Date;
  day: string;
  cursor: Date;
  events: CalendarEvent[];
  tasks: Task[];
  onQuickAdd: (day: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);
  const outside = !isSameMonth(date, cursor);
  const today = isToday(date);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isCalendarChipData(source.data),
      getData: () => ({
        type: "calendar-day" as const,
        dayKey: day,
        instanceId: CALENDAR_DND,
      }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [day]);

  const total = events.length + tasks.length;
  const visibleEvents = events.slice(0, MAX_CHIPS);
  const visibleTasks = tasks.slice(0, Math.max(0, MAX_CHIPS - events.length));
  const hidden = total - visibleEvents.length - visibleTasks.length;

  return (
    <div
      ref={ref}
      className={cn(
        "group/day relative flex min-h-0 flex-col gap-1 overflow-hidden bg-background p-1.5 transition-colors",
        outside && "bg-muted/40",
        isOver && "bg-muted/70",
      )}
    >
      <div className="flex shrink-0 items-center justify-between">
        <span
          className={cn(
            "px-1 text-[11px] leading-relaxed font-nums text-muted-foreground",
            outside && "opacity-50",
            today && "rounded-[5px] bg-foreground px-1.5 text-background",
          )}
        >
          {date.getDate()}
        </span>
        <button
          type="button"
          aria-label="Add event on this day"
          onClick={() => onQuickAdd(date)}
          className="rounded-[5px] p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100"
        >
          <PlusIcon className="size-3" />
        </button>
      </div>
      {visibleEvents.map((event) => (
        <Chip
          key={event.id}
          kind="event"
          id={event.id}
          at={event.startAt}
          title={event.title}
          time={eventTimeLabel(event)}
          className="bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
          onEdit={() => onEditEvent(event)}
        />
      ))}
      {visibleTasks.map((task) => (
        <Chip
          key={task.id}
          kind="task"
          id={task.id}
          at={task.dueAt ?? ""}
          title={task.title}
          className={cn(
            "bg-muted text-foreground",
            task.status === "open" &&
              dueDateInfo(task.dueAt).overdue &&
              "bg-destructive/10 text-destructive",
            task.status !== "open" && "text-muted-foreground line-through",
          )}
          onEdit={() => onEditTask(task)}
        />
      ))}
      {hidden > 0 ? (
        <span className="px-1 text-[10px] text-muted-foreground">
          +{hidden} more
        </span>
      ) : null}
    </div>
  );
}

export function MonthGrid({
  cursor,
  animate,
  events,
  tasks,
  onQuickAdd,
  onEditEvent,
  onEditTask,
  onDropChip,
}: {
  cursor: Date;
  animate: boolean;
  events: CalendarEvent[];
  tasks: Task[];
  onQuickAdd: (day: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
  onDropChip: (chip: CalendarChipData, day: Date) => void;
}) {
  const onDropRef = useRef(onDropChip);
  onDropRef.current = onDropChip;

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => isCalendarChipData(source.data),
      onDrop: ({ source, location }) => {
        if (!isCalendarChipData(source.data)) return;
        const target = location.current.dropTargets
          .map((entry) => entry.data)
          .find(isCalendarDayData);
        if (!target) return;
        onDropRef.current(source.data, new Date(`${target.dayKey}T00:00`));
      },
    });
  }, []);

  const eventsByDay = groupEventsByDay(events);
  const tasksByDay = groupTasksByDay(tasks);
  const days = monthGridDays(cursor);

  return (
    <div
      key={dayKey(cursor)}
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        animate &&
          "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="grid shrink-0 grid-cols-7 px-px pb-1.5">
        {DOW_LABELS.map((label) => (
          <span
            key={label}
            className="px-2 text-[10px] text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60">
        {days.map((date) => {
          const day = dayKey(date);
          return (
            <DayCell
              key={day}
              date={date}
              day={day}
              cursor={cursor}
              events={eventsByDay.get(day) ?? []}
              tasks={tasksByDay.get(day) ?? []}
              onQuickAdd={onQuickAdd}
              onEditEvent={onEditEvent}
              onEditTask={onEditTask}
            />
          );
        })}
      </div>
    </div>
  );
}
