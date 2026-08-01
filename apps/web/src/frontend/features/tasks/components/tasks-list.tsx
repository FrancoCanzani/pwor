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
import { DragHandleDots2Icon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { PageEmpty } from "@components/page-empty";
import type { Task, TaskStatus } from "@features/tasks/api";
import { DragChip } from "@features/tasks/components/drag-chip";
import {
  TASKS_DND,
  isTaskData,
  resolveTaskDrop,
  type TaskMove,
} from "@features/tasks/lib/dnd";
import { relativeTime } from "@features/tasks/lib/relative-time";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  groupTasksByStatus,
} from "@features/tasks/lib/status";

function ListRowContent({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const age = relativeTime(task.updatedAt);

  return (
    <div className="flex items-center gap-4">
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
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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
          "flex cursor-grab items-center gap-1.5 px-4 py-3 transition-colors hover:bg-muted/30 active:cursor-grabbing",
          dragging && "opacity-30",
        )}
      >
        <DragHandleDots2Icon className="shrink-0 text-muted-foreground/40 sm:hidden" />
        <div className="min-w-0 flex-1">
          <ListRowContent task={task} onEdit={onEdit} />
        </div>
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
  const ref = useRef<HTMLElement>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

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
        element,
        canScroll: ({ source }) => isTaskData(source.data),
      }),
    );
  }, [status]);

  const items: ReactNode[] = tasks.map((task, index) => (
    <ListRow
      key={task.id}
      task={task}
      status={status}
      index={index}
      onEdit={onEdit}
    />
  ));

  return (
    <section ref={ref} className="flex flex-col gap-2">
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-3 py-2 transition-colors",
          isOver && "bg-muted",
        )}
      >
        <h2 className="text-sm font-normal text-foreground">
          {TASK_STATUS_LABEL[status]}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <ul
        className={cn(
          "flex min-h-10 flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-background transition-colors",
          isOver && "border-foreground/20",
        )}
      >
        {items}
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
