import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { addMonths, format, isSameDay, startOfMonth } from "date-fns";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  eventsQueryOptions,
  updateEvent,
  type CalendarEvent,
} from "@features/calendar/api";
import { AgendaList } from "@features/calendar/components/agenda-list";
import { EventDialog } from "@features/calendar/components/event-dialog";
import { MonthGrid } from "@features/calendar/components/month-grid";
import type { CalendarChipData } from "@features/calendar/lib/dnd";
import { dayToDefaultAt, rescheduleToDay } from "@features/calendar/lib/month";
import {
  deleteTask,
  tasksQueryOptions,
  updateTask,
  type Task,
  type TaskStatus,
} from "@features/tasks/api";
import { TaskDialog } from "@features/tasks/components/task-dialog";
import { cue } from "@lib/sound";

type CalendarView = "month" | "agenda";

type EventDialogState =
  | { mode: "create"; defaultDate: string | null }
  | { mode: "edit"; event: CalendarEvent };

export function CalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [animateMonth, setAnimateMonth] = useState(false);
  const [eventDialog, setEventDialog] = useState<EventDialogState | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const isMobile = useIsMobile();
  const effectiveView: CalendarView = isMobile ? "agenda" : view;
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  const { data: events = [] } = useQuery(eventsQueryOptions(workspaceId));
  const { data: tasks = [] } = useQuery(tasksQueryOptions("all", workspaceId));

  const eventsKey = eventsQueryOptions(workspaceId).queryKey;
  const tasksKey = tasksQueryOptions("all", workspaceId).queryKey;

  function patchEvents(updater: (items: CalendarEvent[]) => CalendarEvent[]) {
    queryClient.setQueryData<CalendarEvent[]>(eventsKey, (current) =>
      updater(current ?? []),
    );
  }

  function patchTasks(updater: (items: Task[]) => Task[]) {
    queryClient.setQueryData<Task[]>(tasksKey, (current) =>
      updater(current ?? []),
    );
  }

  const invalidateEvents = () =>
    queryClient.invalidateQueries({ queryKey: ["events", "list"] });
  const invalidateTasks = () =>
    queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });

  const rescheduleEvent = useMutation({
    mutationFn: ({
      id,
      startAt,
      endAt,
    }: {
      id: string;
      startAt: string;
      endAt?: string | null;
    }) =>
      updateEvent(id, {
        startAt,
        ...(endAt !== undefined ? { endAt } : {}),
      }),
    onMutate: async ({ id, startAt, endAt }) => {
      await queryClient.cancelQueries({ queryKey: eventsKey });
      const previous = queryClient.getQueryData<CalendarEvent[]>(eventsKey);
      patchEvents((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                startAt,
                ...(endAt !== undefined ? { endAt } : {}),
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(eventsKey, context.previous);
      }
    },
    onSettled: invalidateEvents,
  });

  const rescheduleTask = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) =>
      updateTask(id, { dueAt }),
    onMutate: async ({ id, dueAt }) => {
      await queryClient.cancelQueries({ queryKey: tasksKey });
      const previous = queryClient.getQueryData<Task[]>(tasksKey);
      patchTasks((items) =>
        items.map((item) => (item.id === id ? { ...item, dueAt } : item)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksKey, context.previous);
      }
    },
    onSettled: invalidateTasks,
  });

  const toggleTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTask(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: tasksKey });
      const previous = queryClient.getQueryData<Task[]>(tasksKey);
      if (status === "done") cue("tick");
      patchTasks((items) =>
        items.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksKey, context.previous);
      }
    },
    onSettled: invalidateTasks,
  });

  const renameTask = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateTask(id, { title }),
    onSuccess: invalidateTasks,
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: invalidateTasks,
  });

  function page(delta: number, animate: boolean) {
    setAnimateMonth(animate);
    setCursor((current) => startOfMonth(addMonths(current, delta)));
  }

  function goToday(animate: boolean) {
    setAnimateMonth(animate);
    setCursor(startOfMonth(new Date()));
  }

  const dialogOpen = eventDialog != null || editingTask != null;

  // Keyboard paging skips the animation: repeated actions shouldn't wait.
  const paging = { enabled: effectiveView === "month" && !dialogOpen };
  useHotkey("ArrowLeft", () => page(-1, false), paging);
  useHotkey("ArrowRight", () => page(1, false), paging);
  useHotkey("T", () => goToday(false), paging);

  function handleDropChip(chip: CalendarChipData, day: Date) {
    if (!chip.at || isSameDay(new Date(chip.at), day)) return;
    if (chip.kind === "event") {
      const existing = events.find((item) => item.id === chip.id);
      if (!existing) return;
      const nextStart = rescheduleToDay(existing.startAt, day);
      const delta = nextStart.getTime() - new Date(existing.startAt).getTime();
      rescheduleEvent.mutate({
        id: chip.id,
        startAt: nextStart.toISOString(),
        ...(existing.endAt
          ? {
              endAt: new Date(
                new Date(existing.endAt).getTime() + delta,
              ).toISOString(),
            }
          : {}),
      });
    } else {
      rescheduleTask.mutate({
        id: chip.id,
        dueAt: rescheduleToDay(chip.at, day).toISOString(),
      });
    }
  }

  function handleResizeEvent(
    id: string,
    next: { startAt: string; endAt: string | null },
  ) {
    rescheduleEvent.mutate({ id, startAt: next.startAt, endAt: next.endAt });
  }

  function handleToggleTask(task: Task) {
    toggleTask.mutate({
      id: task.id,
      status: task.status === "done" ? "open" : "done",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="relative flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="text-base font-normal tracking-tight">Calendar</h1>
          {effectiveView === "month" ? (
            <span className="truncate text-sm font-nums text-muted-foreground">
              {format(cursor, "MMMM yyyy")}
            </span>
          ) : null}
        </div>

        {!isMobile ? (
          <div className="absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center overflow-hidden rounded-md border border-border bg-background">
              {(
                [
                  { id: "month", label: "Month" },
                  { id: "agenda", label: "Agenda" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setView(option.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-normal",
                    view === option.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-1.5">
          {effectiveView === "month" ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() => page(-1, true)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="sm" onClick={() => goToday(true)}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                onClick={() => page(1, true)}
              >
                <ChevronRightIcon />
              </Button>
            </>
          ) : null}
          <Button
            variant="new"
            onClick={() =>
              setEventDialog({ mode: "create", defaultDate: null })
            }
          >
            New
          </Button>
        </div>
      </div>

      {effectiveView === "month" ? (
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-1">
          <MonthGrid
            cursor={cursor}
            animate={animateMonth}
            events={events}
            tasks={tasks}
            onQuickAdd={(day) =>
              setEventDialog({
                mode: "create",
                defaultDate: dayToDefaultAt(day),
              })
            }
            onEditEvent={(event) => setEventDialog({ mode: "edit", event })}
            onEditTask={setEditingTask}
            onDropChip={handleDropChip}
            onResizeEvent={handleResizeEvent}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2">
          <AgendaList
            events={events}
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onEditTask={setEditingTask}
            onEditEvent={(event) => setEventDialog({ mode: "edit", event })}
          />
        </div>
      )}

      <EventDialog
        open={eventDialog != null}
        event={eventDialog?.mode === "edit" ? eventDialog.event : null}
        defaultDate={
          eventDialog?.mode === "create" ? eventDialog.defaultDate : null
        }
        onOpenChange={(open) => {
          if (!open) setEventDialog(null);
        }}
        onCreated={(created) => {
          patchEvents((items) => [...items, created]);
          invalidateEvents();
        }}
        onSaved={(saved) => {
          patchEvents((items) =>
            items.map((item) => (item.id === saved.id ? saved : item)),
          );
          invalidateEvents();
        }}
        onDeleted={(id) => {
          patchEvents((items) => items.filter((item) => item.id !== id));
          invalidateEvents();
        }}
      />

      <TaskDialog
        open={editingTask != null}
        task={editingTask}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        onCreated={() => {}}
        onSave={(title) => {
          if (editingTask) renameTask.mutate({ id: editingTask.id, title });
        }}
        onDelete={() => {
          if (editingTask) removeTask.mutate(editingTask.id);
        }}
      />
    </div>
  );
}
