import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";

import type { Task, TaskStatus } from "@features/tasks/api";
import {
  TASK_STATUSES,
  groupTasksByStatus,
} from "@features/tasks/lib/status";

export const TASKS_DND = Symbol("tasks-dnd");

export type TaskDragData = {
  type: "task";
  taskId: string;
  status: TaskStatus;
  index: number;
  rect: DOMRect;
  instanceId: typeof TASKS_DND;
};

export type ColumnDragData = {
  type: "column";
  status: TaskStatus;
  instanceId: typeof TASKS_DND;
};

export type TaskMove = {
  taskId: string;
  status: TaskStatus;
  index: number;
};

export function isTaskData(
  data: Record<string | symbol, unknown>,
): data is TaskDragData {
  return data.type === "task" && data.instanceId === TASKS_DND;
}

export function isColumnData(
  data: Record<string | symbol, unknown>,
): data is ColumnDragData {
  return data.type === "column" && data.instanceId === TASKS_DND;
}

export function applyMove(items: Task[], move: TaskMove): Task[] {
  const moving = items.find((task) => task.id === move.taskId);
  if (!moving) return items;

  const others = items.filter((task) => task.id !== move.taskId);
  const updated: Task = {
    ...moving,
    status: move.status,
    updatedAt: new Date().toISOString(),
  };
  const grouped = groupTasksByStatus(others);
  const column = [...grouped[move.status]];
  column.splice(Math.max(0, Math.min(move.index, column.length)), 0, updated);

  const result: Task[] = [];
  for (const status of TASK_STATUSES) {
    result.push(...(status === move.status ? column : grouped[status]));
  }
  return result;
}

export function moveKey(move: TaskMove): string {
  return `${move.taskId}:${move.status}:${move.index}`;
}

/** Resolve against a freeze-frame snapshot from drag start (stable live preview). */
export function resolveTaskDrop({
  source,
  dropTargets,
  grouped,
}: {
  source: TaskDragData;
  dropTargets: { data: Record<string | symbol, unknown> }[];
  grouped: Record<TaskStatus, Task[]>;
}): TaskMove | null {
  if (dropTargets.length === 0) return null;

  const target = dropTargets[0]!;
  const taskTarget = isTaskData(target.data) ? target.data : null;
  const columnTarget = dropTargets.map((entry) => entry.data).find(isColumnData);
  if (!columnTarget) return null;

  const destinationStatus = columnTarget.status;
  const destinationColumn = grouped[destinationStatus];
  const sourceStatus = source.status;
  const sourceIndex = grouped[sourceStatus].findIndex(
    (task) => task.id === source.taskId,
  );
  if (sourceIndex < 0) return null;

  let destinationIndex: number;

  if (taskTarget && taskTarget.status === destinationStatus) {
    const indexOfTarget = destinationColumn.findIndex(
      (task) => task.id === taskTarget.taskId,
    );
    if (indexOfTarget < 0) return null;

    const edge = extractClosestEdge(target.data) as Edge | null;

    if (sourceStatus === destinationStatus) {
      destinationIndex = getReorderDestinationIndex({
        startIndex: sourceIndex,
        indexOfTarget,
        closestEdgeOfTarget: edge,
        axis: "vertical",
      });
    } else {
      destinationIndex = edge === "bottom" ? indexOfTarget + 1 : indexOfTarget;
    }
  } else if (sourceStatus === destinationStatus) {
    destinationIndex = getReorderDestinationIndex({
      startIndex: sourceIndex,
      indexOfTarget: Math.max(destinationColumn.length - 1, 0),
      closestEdgeOfTarget: null,
      axis: "vertical",
    });
  } else {
    destinationIndex = destinationColumn.length;
  }

  if (sourceStatus === destinationStatus && sourceIndex === destinationIndex) {
    return null;
  }

  return {
    taskId: source.taskId,
    status: destinationStatus,
    index: destinationIndex,
  };
}
