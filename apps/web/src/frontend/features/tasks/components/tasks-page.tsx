import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  deleteTask,
  tasksQueryOptions,
  updateTask,
  type Task,
} from "@features/tasks/api";
import { TaskDialog } from "@features/tasks/components/task-dialog";
import { TasksKanban } from "@features/tasks/components/tasks-kanban";
import { TasksList } from "@features/tasks/components/tasks-list";
import { applyMove, type TaskMove } from "@features/tasks/lib/dnd";
import { cue } from "@lib/sound";

type TaskDialogState = { mode: "create" } | { mode: "edit"; task: Task };

type TasksView = "kanban" | "list";

export function TasksPage() {
  const [view, setView] = useState<TasksView>("kanban");
  const [taskDialog, setTaskDialog] = useState<TaskDialogState | null>(null);
  const isMobile = useIsMobile();
  const effectiveView: TasksView = isMobile ? "list" : view;
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const { data: tasks = [] } = useQuery(tasksQueryOptions("all", workspaceId));

  const listKey = tasksQueryOptions("all", workspaceId).queryKey;

  function patchCache(updater: (items: Task[]) => Task[]) {
    queryClient.setQueryData<Task[]>(listKey, (current) =>
      updater(current ?? []),
    );
  }

  const invalidateTasks = () =>
    queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateTask(id, { title }),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Task[]>(listKey);
      patchCache((items) =>
        items.map((task) => (task.id === id ? { ...task, title } : task)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: invalidateTasks,
  });

  const move = useMutation({
    mutationFn: ({ taskId, status }: TaskMove) =>
      updateTask(taskId, { status }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Task[]>(listKey) ?? [];
      const previousStatus = previous.find(
        (task) => task.id === next.taskId,
      )?.status;
      if (previousStatus != null && previousStatus !== next.status) {
        if (next.status === "done") cue("tick");
        else if (next.status === "dismissed") cue("droplet");
      }
      patchCache((items) => applyMove(items, next));
      return { previous, previousStatus };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: (_data, _error, vars, context) => {
      if (context?.previousStatus !== vars.status) {
        invalidateTasks();
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Task[]>(listKey);
      patchCache((items) => items.filter((task) => task.id !== id));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: invalidateTasks,
  });

  function handleMove(next: TaskMove) {
    move.mutate(next);
  }

  function handleCreated(task: Task) {
    patchCache((items) => [...items, task]);
    invalidateTasks();
  }

  function handleDialogSave(title: string) {
    if (taskDialog?.mode !== "edit") return;
    rename.mutate({ id: taskDialog.task.id, title });
  }

  function handleDialogDelete() {
    if (taskDialog?.mode !== "edit") return;
    remove.mutate(taskDialog.task.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="relative flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-4">
        <h1 className="text-base font-normal tracking-tight">Tasks</h1>

        {!isMobile ? (
          <div className="absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center overflow-hidden rounded-md border border-border bg-background">
              {(
                [
                  { id: "kanban", label: "Kanban" },
                  { id: "list", label: "List" },
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

        <Button
          variant="new"
          onClick={() => setTaskDialog({ mode: "create" })}
        >
          New
        </Button>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 pt-2",
          effectiveView === "list" ? "overflow-y-auto px-6" : "flex flex-col",
        )}
      >
        {effectiveView === "list" ? (
          <TasksList
            tasks={tasks}
            onMove={handleMove}
            onEdit={(task) => setTaskDialog({ mode: "edit", task })}
          />
        ) : (
          <TasksKanban
            tasks={tasks}
            onMove={handleMove}
            onEdit={(task) => setTaskDialog({ mode: "edit", task })}
          />
        )}
      </div>

      <TaskDialog
        open={taskDialog != null}
        task={taskDialog?.mode === "edit" ? taskDialog.task : null}
        onOpenChange={(open) => {
          if (!open) setTaskDialog(null);
        }}
        onCreated={handleCreated}
        onSave={handleDialogSave}
        onDelete={handleDialogDelete}
      />
    </div>
  );
}
