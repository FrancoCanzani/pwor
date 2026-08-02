import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import {
  attachClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { ClockIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@features/tasks/api";
import { DragChip } from "@features/tasks/components/drag-chip";
import {
  TASKS_DND,
  isTaskData,
  resolveTaskDrop,
  type TaskMove,
} from "@features/tasks/lib/dnd";
import { dueDateInfo } from "@features/tasks/lib/due-date";
import { useRelativeTime } from "@features/tasks/lib/relative-time";
import {
  TASK_STATUSES,
  TASK_STATUS_ICON,
  TASK_STATUS_ICON_COLOR,
  TASK_STATUS_LABEL,
  groupTasksByStatus,
} from "@features/tasks/lib/status";

export type { TaskMove };

function TaskCardBody({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const age = useRelativeTime(task.updatedAt);
  const due = dueDateInfo(task.dueAt);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
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
        {age ? (
          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
            {age}
          </span>
        ) : null}
      </div>
      {due.group !== "no-date" ? (
        <div
          className={cn(
            "flex w-fit items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground",
            due.overdue && "bg-destructive/10 text-destructive",
          )}
        >
          <ClockIcon className="size-3" />
          <span>{due.label}</span>
        </div>
      ) : null}
    </div>
  );
}

function KanbanCard({
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
  const outerRef = useRef<HTMLLIElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    return combine(
      draggable({
        element: inner,
        getInitialData: () => ({
          type: "task" as const,
          taskId: task.id,
          status,
          index: indexRef.current,
          rect: inner.getBoundingClientRect(),
          instanceId: TASKS_DND,
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
      }),
      dropTargetForElements({
        element: outer,
        getIsSticky: () => true,
        canDrop: ({ source }) => isTaskData(source.data),
        getData: ({ input }) =>
          attachClosestEdge(
            {
              type: "task",
              taskId: task.id,
              status,
              index: indexRef.current,
              instanceId: TASKS_DND,
            },
            {
              element: outer,
              input,
              allowedEdges: ["top", "bottom"],
            },
          ),
      }),
    );
  }, [status, task.id]);

  return (
    <li ref={outerRef} className="relative list-none">
      <div
        ref={innerRef}
        className={cn(
          "cursor-grab touch-none rounded-lg border border-border/60 bg-background px-3 py-2.5 transition-colors active:cursor-grabbing active:border-foreground/30",
          dragging && "opacity-30",
        )}
      >
        <TaskCardBody task={task} onEdit={onEdit} />
      </div>
      {preview ? createPortal(<DragChip title={task.title} />, preview) : null}
    </li>
  );
}

function KanbanColumn({
  status,
  tasks,
  onEdit,
}: {
  status: TaskStatus;
  tasks: Task[];
  onEdit: (task: Task) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [isOver, setIsOver] = useState(false);
  const Icon = TASK_STATUS_ICON[status];

  useEffect(() => {
    const element = ref.current;
    const list = listRef.current;
    if (!element || !list) return;

    return combine(
      dropTargetForElements({
        element,
        getIsSticky: () => true,
        canDrop: ({ source }) => isTaskData(source.data),
        getData: () => ({
          type: "column" as const,
          status,
          instanceId: TASKS_DND,
        }),
        onDragEnter: () => setIsOver(true),
        onDrag: () => setIsOver(true),
        onDragLeave: () => setIsOver(false),
        onDrop: () => setIsOver(false),
      }),
      autoScrollForElements({
        element: list,
        canScroll: ({ source }) => isTaskData(source.data),
      }),
    );
  }, [status]);

  const items: ReactNode[] = tasks.map((task, index) => (
    <KanbanCard
      key={task.id}
      task={task}
      status={status}
      index={index}
      onEdit={onEdit}
    />
  ));

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-xl border border-border/60 bg-muted/40",
        isOver && "bg-muted/70",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("size-3.5", TASK_STATUS_ICON_COLOR[status])} />
          <h2 className="text-xs font-normal text-foreground">
            {TASK_STATUS_LABEL[status]}
          </h2>
        </div>
        <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <ul
        ref={listRef}
        className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-3"
      >
        {items}
      </ul>
    </div>
  );
}

export function TasksKanban({
  tasks,
  onMove,
  onEdit,
}: {
  tasks: Task[];
  onMove: (move: TaskMove) => void;
  onEdit: (task: Task) => void;
}) {
  const grouped = groupTasksByStatus(tasks);
  const groupedRef = useRef(grouped);
  const onMoveRef = useRef(onMove);

  groupedRef.current = grouped;
  onMoveRef.current = onMove;

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => isTaskData(source.data),
      onDrop: ({ source, location }) => {
        if (!isTaskData(source.data)) return;
        const next = resolveTaskDrop({
          source: source.data,
          dropTargets: location.current.dropTargets,
          grouped: groupedRef.current,
        });
        if (!next) return;
        onMoveRef.current(next);
      },
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-x-auto overflow-y-auto px-6 pb-6">
      <div className="mx-auto flex h-full w-full max-w-3xl gap-3">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={grouped[status]}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
