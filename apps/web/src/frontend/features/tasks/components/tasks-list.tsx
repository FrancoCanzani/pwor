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
import { PageEmpty } from "@components/page-empty";
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

function ListRowContent({
  task,
  onRename,
  onDelete,
}: {
  task: Task;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
}) {
  const age = relativeTime(task.updatedAt);

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="min-w-0 flex-1">
        <EditableTaskTitle
          task={task}
          onSave={(title) => onRename(task, title)}
        />
      </div>
      {age ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {age}
        </span>
      ) : null}
      <TaskDeleteButton
        task={task}
        onDelete={onDelete}
        className="opacity-0 group-hover/row:opacity-100"
      />
    </div>
  );
}

function ListRow({
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
          "group/row flex cursor-grab items-center gap-2 border-b border-border/50 px-1 active:cursor-grabbing",
          dragging && "opacity-30",
        )}
      >
        <div className="min-w-0 flex-1">
          <ListRowContent task={task} onRename={onRename} onDelete={onDelete} />
        </div>
      </div>
      {preview
        ? createPortal(
            <div
              className="rounded-md border border-border bg-background px-3 py-2 opacity-95 shadow-sm"
              style={{ width: preview.rect.width }}
            >
              <ListRowContent
                task={task}
                onRename={onRename}
                onDelete={onDelete}
              />
            </div>,
            preview.container,
          )
        : null}
    </li>
  );
}

function StatusSection({
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

  if (tasks.length === 0 && !placeholder && !isOver) return null;

  const placeholderRow = (key: string) => (
    <li key={key} className="list-none px-1">
      <div className="flex items-center" style={{ height: Math.max(placeholder!.height, 32) }}>
        <div className="h-0.5 w-full rounded-full bg-primary" />
      </div>
    </li>
  );

  const items: ReactNode[] = [];
  tasks.forEach((task, index) => {
    if (placeholder?.index === index) {
      items.push(placeholderRow(`ph-${status}`));
    }
    items.push(
      <ListRow
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
    items.push(placeholderRow(`ph-end-${status}`));
  }

  return (
    <section
      ref={ref}
      className={cn("rounded-md", isOver && "bg-muted/30")}
    >
      <div className="flex items-baseline justify-between gap-4 px-1 pb-1.5">
        <h2 className="text-[11px] font-normal tracking-wide text-muted-foreground uppercase">
          {TASK_STATUS_LABEL[status]}
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground/70">
          {tasks.length}
        </span>
      </div>
      <ul className="flex min-h-10 flex-col">{items}</ul>
    </section>
  );
}

export function TasksList({
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

  if (tasks.length === 0) {
    return (
      <PageEmpty
        title="Nothing to do"
        description="Add a task, or wait for one to show up from something you capture."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-10">
      {TASK_STATUSES.map((status) => (
        <StatusSection
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
  );
}
