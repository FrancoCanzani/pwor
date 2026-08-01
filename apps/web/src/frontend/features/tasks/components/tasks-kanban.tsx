import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import {
  attachClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@features/tasks/api";
import { EditableTaskTitle } from "@features/tasks/components/editable-task-title";
import { TaskDeleteButton } from "@features/tasks/components/task-delete-button";
import {
  TASKS_DND,
  isTaskData,
  moveKey,
  resolveTaskDrop,
  type TaskMove,
} from "@features/tasks/lib/dnd";
import { relativeTime } from "@features/tasks/lib/relative-time";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  groupTasksByStatus,
} from "@features/tasks/lib/status";

export type { TaskMove };

function TaskCardBody({
  task,
  onRename,
}: {
  task: Task;
  onRename: (task: Task, title: string) => void;
}) {
  const age = relativeTime(task.updatedAt);

  return (
    <div className="flex items-start justify-between gap-3">
      <EditableTaskTitle
        task={task}
        onSave={(title) => onRename(task, title)}
        className="flex-1"
      />
      {age ? (
        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {age}
        </span>
      ) : null}
    </div>
  );
}

function DropPlaceholder({ height }: { height: number }) {
  return (
    <div className="flex items-center" style={{ height: Math.max(height, 44) }}>
      <div className="h-0.5 w-full rounded-full bg-primary" />
    </div>
  );
}

function KanbanCard({
  task,
  status,
  index,
  onRename,
  onDelete,
}: {
  task: Task;
  status: TaskStatus;
  index: number;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
}) {
  const outerRef = useRef<HTMLLIElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{
    container: HTMLElement;
    rect: DOMRect;
  } | null>(null);

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
        onGenerateDragPreview: ({ nativeSetDragImage, location, source }) => {
          const rect = source.element.getBoundingClientRect();
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element: inner,
              input: location.current.input,
            }),
            render({ container }) {
              setPreview({ container, rect });
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
          "group/card flex cursor-grab items-start gap-2 rounded-md border border-border/60 bg-background px-3 py-2.5 active:cursor-grabbing",
          dragging && "opacity-30",
        )}
      >
        <div className="min-w-0 flex-1">
          <TaskCardBody task={task} onRename={onRename} />
        </div>
        <TaskDeleteButton
          task={task}
          onDelete={onDelete}
          className="opacity-0 group-hover/card:opacity-100"
        />
      </div>
      {preview
        ? createPortal(
            <div
              className="rounded-md border border-border bg-background px-3 py-2.5 opacity-95 shadow-sm"
              style={{ width: preview.rect.width }}
            >
              <TaskCardBody task={task} onRename={onRename} />
            </div>,
            preview.container,
          )
        : null}
    </li>
  );
}

function KanbanColumn({
  status,
  tasks,
  placeholder,
  onRename,
  onDelete,
}: {
  status: TaskStatus;
  tasks: Task[];
  placeholder: { index: number; height: number } | null;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [isOver, setIsOver] = useState(false);

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

  const items: ReactNode[] = [];
  tasks.forEach((task, index) => {
    if (placeholder?.index === index) {
      items.push(
        <li key={`ph-${status}`} className="list-none">
          <DropPlaceholder height={placeholder.height} />
        </li>,
      );
    }
    items.push(
      <KanbanCard
        key={task.id}
        task={task}
        status={status}
        index={index}
        onRename={onRename}
        onDelete={onDelete}
      />,
    );
  });
  if (placeholder && placeholder.index >= tasks.length) {
    items.push(
      <li key={`ph-end-${status}`} className="list-none">
        <DropPlaceholder height={placeholder.height} />
      </li>,
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex w-[260px] shrink-0 flex-col rounded-lg bg-muted/40",
        isOver && "bg-muted/70",
      )}
    >
      <div className="flex shrink-0 items-baseline justify-between gap-3 px-3 pt-3 pb-2">
        <h2 className="text-xs font-normal text-foreground">
          {TASK_STATUS_LABEL[status]}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
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
  onRename,
  onDelete,
}: {
  tasks: Task[];
  onMove: (move: TaskMove) => void;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
}) {
  const grouped = groupTasksByStatus(tasks);
  const groupedRef = useRef(grouped);
  const onMoveRef = useRef(onMove);
  const lastKey = useRef<string | null>(null);
  const [hint, setHint] = useState<{
    move: TaskMove;
    height: number;
  } | null>(null);

  groupedRef.current = grouped;
  onMoveRef.current = onMove;

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => isTaskData(source.data),
      onDragStart: () => {
        lastKey.current = null;
        setHint(null);
      },
      onDrag: ({ source, location }) => {
        if (!isTaskData(source.data)) return;
        const next = resolveTaskDrop({
          source: source.data,
          dropTargets: location.current.dropTargets,
          grouped: groupedRef.current,
        });
        if (!next) {
          setHint(null);
          lastKey.current = null;
          return;
        }
        const key = moveKey(next);
        if (key === lastKey.current) return;
        lastKey.current = key;
        setHint({ move: next, height: source.data.rect.height });
      },
      onDrop: ({ source, location }) => {
        lastKey.current = null;
        setHint(null);
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
    <div className="flex min-h-0 flex-1 justify-center overflow-x-auto px-6 pb-6">
      <div className="flex h-full gap-3">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={grouped[status]}
            placeholder={
              hint?.move.status === status
                ? { index: hint.move.index, height: hint.height }
                : null
            }
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
