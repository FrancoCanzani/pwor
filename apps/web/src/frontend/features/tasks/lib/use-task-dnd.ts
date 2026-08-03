import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { useEffect, useRef, useState, type RefObject } from "react";

import type { Task, TaskStatus } from "@features/tasks/api";
import {
  TASKS_DND,
  isTaskData,
  resolveTaskDrop,
  type TaskMove,
} from "@features/tasks/lib/dnd";

export function useTaskCardDnd(taskId: string, status: TaskStatus, index: number) {
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
          taskId,
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
              taskId,
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
  }, [status, taskId]);

  return { outerRef, innerRef, dragging, preview };
}

export function useTaskColumnDnd<
  TColumn extends HTMLElement,
  TScroll extends HTMLElement,
>(status: TaskStatus, scrollRef?: RefObject<TScroll | null>) {
  const columnRef = useRef<TColumn>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const element = columnRef.current;
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
        element: scrollRef?.current ?? element,
        canScroll: ({ source }) => isTaskData(source.data),
      }),
    );
  }, [status]);

  return { columnRef, isOver };
}

export function useTaskDropMonitor(
  grouped: Record<TaskStatus, Task[]>,
  onMove: (move: TaskMove) => void,
) {
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
}
