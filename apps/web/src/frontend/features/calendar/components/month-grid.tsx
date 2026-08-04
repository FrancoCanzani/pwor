import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { DragHandleDots2Icon, PlusIcon } from "@radix-ui/react-icons";
import { isSameMonth, isToday, startOfDay } from "date-fns";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  EVENT_LANE_HEIGHT,
  eventTimeLabel,
  groupTasksByDay,
  groupTimedEventsByDay,
  layoutWeekSpans,
  MAX_EVENT_LANES,
  monthWeeks,
  resizeEventEnd,
  resizeEventStart,
  type WeekSpan,
} from "@features/calendar/lib/month";
import type { Task } from "@features/tasks/api";
import { DragChip } from "@features/tasks/components/drag-chip";
import { dueDateInfo } from "@features/tasks/lib/due-date";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_DAY_CHIPS = 3;

type ResizeEdge = "start" | "end";

type ResizeState = {
  eventId: string;
  edge: ResizeEdge;
  preview: CalendarEvent;
};

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
          getOffset: () => ({ x: 12, y: 10 }),
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
      {preview ? (
        createPortal(
          <DragChip title={title} variant="day" className={className} />,
          preview,
        )
      ) : null}
    </>
  );
}

function EventBar({
  segment,
  resizing,
  onEdit,
  onResizeStart,
}: {
  segment: WeekSpan;
  resizing: boolean;
  onEdit: () => void;
  onResizeStart: (
    edge: ResizeEdge,
    event: CalendarEvent,
    pointerEvent: ReactPointerEvent<HTMLDivElement>,
  ) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<HTMLElement | null>(null);
  const { event, startCol, span, lane, isRangeStart, isRangeEnd } = segment;

  useEffect(() => {
    const element = ref.current;
    if (!element || resizing) return;
    return draggable({
      element,
      getInitialData: (): CalendarChipData => ({
        type: "calendar-chip",
        kind: "event",
        id: event.id,
        at: event.startAt,
        instanceId: CALENDAR_DND,
      }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: 12, y: 10 }),
          render({ container }) {
            setPreview(container);
            return () => setPreview(null);
          },
        });
      },
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [event.id, event.startAt, resizing]);

  return (
    <>
      <div
        ref={ref}
        title={event.title}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className={cn(
          "group/bar pointer-events-auto absolute z-[1] flex touch-none items-center truncate rounded-md bg-blue-50 text-[11px] leading-none text-blue-800 dark:bg-blue-950 dark:text-blue-200",
          "cursor-grab active:cursor-grabbing",
          isRangeStart ? "pl-3" : "rounded-l-none pl-1.5",
          isRangeEnd ? "pr-3" : "rounded-r-none pr-1.5",
          dragging && "opacity-30",
          resizing && "ring-1 ring-blue-400",
        )}
        style={{
          left: `calc(${(startCol / 7) * 100}% + 2px)`,
          width: `calc(${(span / 7) * 100}% - 4px)`,
          top: lane * EVENT_LANE_HEIGHT,
          height: EVENT_LANE_HEIGHT - 2,
        }}
      >
        {isRangeStart ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize start"
            title="Drag to change start"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onResizeStart("start", event, e);
            }}
            className="absolute inset-y-0 left-0 z-[2] flex w-3 cursor-ew-resize items-center justify-center"
          >
            <DragHandleDots2Icon className="size-2.5 opacity-40 transition-opacity group-hover/bar:opacity-70" />
          </div>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{event.title}</span>
        {isRangeEnd ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize end"
            title="Drag to change end"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onResizeStart("end", event, e);
            }}
            className="absolute inset-y-0 right-0 z-[2] flex w-3 cursor-ew-resize items-center justify-center"
          >
            <DragHandleDots2Icon className="size-2.5 opacity-40 transition-opacity group-hover/bar:opacity-70" />
          </div>
        ) : null}
      </div>
      {preview ? (
        createPortal(
          <DragChip
            title={event.title}
            variant="day"
            className="bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
          />,
          preview,
        )
      ) : null}
    </>
  );
}

function DayCell({
  date,
  day,
  cursor,
  timedEvents,
  tasks,
  laneCount,
  hiddenCount,
  onQuickAdd,
  onEditEvent,
  onEditTask,
}: {
  date: Date;
  day: string;
  cursor: Date;
  timedEvents: CalendarEvent[];
  tasks: Task[];
  laneCount: number;
  hiddenCount: number;
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

  const headerHeight = 26;
  const barsHeight = laneCount * EVENT_LANE_HEIGHT;
  const chipBudget = Math.max(0, MAX_DAY_CHIPS - laneCount);
  const visibleTimed = timedEvents.slice(0, chipBudget);
  const remainingAfterTimed = Math.max(0, chipBudget - visibleTimed.length);
  const visibleTasks = tasks.slice(0, remainingAfterTimed);
  const buried =
    hiddenCount +
    (timedEvents.length - visibleTimed.length) +
    (tasks.length - visibleTasks.length);

  return (
    <div
      ref={ref}
      data-calendar-day={day}
      className={cn(
        "group/day relative flex min-h-0 flex-col gap-1 overflow-hidden bg-background px-1.5 pb-1.5 transition-colors",
        outside && "bg-muted/40",
        isOver && "bg-muted/70",
      )}
      style={{ paddingTop: headerHeight + barsHeight }}
    >
      <div className="absolute inset-x-1.5 top-1.5 flex h-[18px] shrink-0 items-center justify-between">
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
      {visibleTimed.map((event) => (
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
      {buried > 0 ? (
        <span className="px-1 text-[10px] text-muted-foreground">
          +{buried} more
        </span>
      ) : null}
    </div>
  );
}

function WeekRow({
  weekDays,
  cursor,
  events,
  timedByDay,
  tasksByDay,
  resize,
  onQuickAdd,
  onEditEvent,
  onEditTask,
  onResizeStart,
}: {
  weekDays: Date[];
  cursor: Date;
  events: CalendarEvent[];
  timedByDay: Map<string, CalendarEvent[]>;
  tasksByDay: Map<string, Task[]>;
  resize: ResizeState | null;
  onQuickAdd: (day: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
  onResizeStart: (
    edge: ResizeEdge,
    event: CalendarEvent,
    pointerEvent: ReactPointerEvent<HTMLDivElement>,
  ) => void;
}) {
  const spans = layoutWeekSpans(weekDays, events);
  const visibleSpans = spans.filter((span) => span.lane < MAX_EVENT_LANES);
  const maxLane = visibleSpans.reduce((max, span) => Math.max(max, span.lane), -1);
  const laneCount = maxLane + 1;

  const hiddenByDay = new Map<string, number>();
  for (const span of spans) {
    if (span.lane < MAX_EVENT_LANES) continue;
    for (let col = 0; col < span.span; col++) {
      const day = weekDays[span.startCol + col]!;
      const key = dayKey(day);
      hiddenByDay.set(key, (hiddenByDay.get(key) ?? 0) + 1);
    }
  }

  return (
    <div className="relative grid min-h-0 flex-1 grid-cols-7 gap-px">
      {weekDays.map((date) => {
        const day = dayKey(date);
        return (
          <DayCell
            key={day}
            date={date}
            day={day}
            cursor={cursor}
            timedEvents={timedByDay.get(day) ?? []}
            tasks={tasksByDay.get(day) ?? []}
            laneCount={laneCount}
            hiddenCount={hiddenByDay.get(day) ?? 0}
            onQuickAdd={onQuickAdd}
            onEditEvent={onEditEvent}
            onEditTask={onEditTask}
          />
        );
      })}
      <div
        className="pointer-events-none absolute inset-x-0 z-[1]"
        style={{ top: 26 }}
      >
        {visibleSpans.map((segment) => (
          <EventBar
            key={segment.event.id}
            segment={segment}
            resizing={resize?.eventId === segment.event.id}
            onEdit={() => onEditEvent(segment.event)}
            onResizeStart={onResizeStart}
          />
        ))}
      </div>
    </div>
  );
}

function dayFromPoint(clientX: number, clientY: number): Date | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue;
    const key = node.dataset.calendarDay ?? node.closest<HTMLElement>("[data-calendar-day]")?.dataset.calendarDay;
    if (key) return startOfDay(new Date(`${key}T12:00`));
  }
  return null;
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
  onResizeEvent,
}: {
  cursor: Date;
  animate: boolean;
  events: CalendarEvent[];
  tasks: Task[];
  onQuickAdd: (day: Date) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
  onDropChip: (chip: CalendarChipData, day: Date) => void;
  onResizeEvent: (
    id: string,
    next: { startAt: string; endAt: string | null },
  ) => void;
}) {
  const onDropRef = useRef(onDropChip);
  onDropRef.current = onDropChip;
  const onResizeRef = useRef(onResizeEvent);
  onResizeRef.current = onResizeEvent;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const [resize, setResize] = useState<ResizeState | null>(null);

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

  function handleResizeStart(
    edge: ResizeEdge,
    event: CalendarEvent,
    pointerEvent: ReactPointerEvent<HTMLDivElement>,
  ) {
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();

    let latest: CalendarEvent = event;
    setResize({ eventId: event.id, edge, preview: event });

    function applyDay(day: Date) {
      const current = eventsRef.current.find((item) => item.id === event.id);
      if (!current) return;
      const next =
        edge === "start"
          ? resizeEventStart(current, day)
          : resizeEventEnd(current, day);
      latest = {
        ...current,
        startAt: next.startAt,
        endAt: next.endAt,
        allDay: true,
      };
      setResize({ eventId: event.id, edge, preview: latest });
    }

    function onPointerMove(moveEvent: PointerEvent) {
      const day = dayFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (day) applyDay(day);
    }

    function finish(commit: boolean) {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      setResize(null);
      if (!commit) return;
      const original = eventsRef.current.find((item) => item.id === event.id);
      if (!original) return;
      if (
        original.startAt === latest.startAt &&
        original.endAt === latest.endAt
      ) {
        return;
      }
      onResizeRef.current(event.id, {
        startAt: latest.startAt,
        endAt: latest.endAt,
      });
    }

    function onPointerUp() {
      finish(true);
    }

    function onPointerCancel() {
      finish(false);
    }

    function onKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        finish(false);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
  }

  const displayEvents = resize
    ? events.map((event) =>
        event.id === resize.eventId ? resize.preview : event,
      )
    : events;

  const timedByDay = groupTimedEventsByDay(displayEvents);
  const tasksByDay = groupTasksByDay(tasks);
  const weeks = monthWeeks(cursor);

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
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60">
        {weeks.map((weekDays) => (
          <WeekRow
            key={dayKey(weekDays[0]!)}
            weekDays={weekDays}
            cursor={cursor}
            events={displayEvents}
            timedByDay={timedByDay}
            tasksByDay={tasksByDay}
            resize={resize}
            onQuickAdd={onQuickAdd}
            onEditEvent={onEditEvent}
            onEditTask={onEditTask}
            onResizeStart={handleResizeStart}
          />
        ))}
      </div>
    </div>
  );
}
