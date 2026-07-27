import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageEmpty } from "@components/page-empty";
import { PageHeader } from "@components/page-header";
import {
  createTask,
  tasksQueryOptions,
  updateTaskStatus,
  type Task,
} from "@features/tasks/api";
import { TaskRow } from "@features/tasks/components/task-row";

type DateGroup = "overdue" | "today" | "tomorrow" | "upcoming" | "no-date";

const GROUP_ORDER: DateGroup[] = [
  "overdue",
  "today",
  "tomorrow",
  "upcoming",
  "no-date",
];

const GROUP_LABEL: Record<DateGroup, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  upcoming: "Upcoming",
  "no-date": "No date",
};

function dateGroupFor(task: Task): DateGroup {
  if (!task.dueAt) return "no-date";

  const diffDays = Math.round(
    (new Date(task.dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return "upcoming";
}

export function TasksPage() {
  const [title, setTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery(
    tasksQueryOptions(showCompleted ? "all" : "open"),
  );

  const invalidateTasks = () =>
    queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });

  const create = useMutation({
    mutationFn: () => createTask(title.trim()),
    onSuccess: () => {
      setTitle("");
      invalidateTasks();
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateTaskStatus(id, done ? "done" : "open"),
    onSuccess: invalidateTasks,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || create.isPending) return;
    create.mutate();
  }

  const open = tasks.filter((task) => task.status === "open");
  const completed = tasks.filter((task) => task.status === "done");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <PageHeader
          title="Tasks"
          description="Things to do, and things you'll be reminded about."
        />
        <Button
          variant="ghost"
          size="sm"
          className="font-normal"
          onClick={() => setShowCompleted((value) => !value)}
        >
          {showCompleted ? "Hide completed" : "Show completed"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="font-normal"
        />
        <Button
          type="submit"
          className="font-normal"
          disabled={!title.trim() || create.isPending}
        >
          Add
        </Button>
      </form>

      {isLoading ? null : open.length === 0 && completed.length === 0 ? (
        <PageEmpty
          title="Nothing to do"
          description="Add a task, or wait for one to show up from something you capture."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {GROUP_ORDER.map((group) => {
            const groupTasks = open.filter(
              (task) => dateGroupFor(task) === group,
            );
            if (groupTasks.length === 0) return null;

            return (
              <section key={group} className="flex flex-col gap-2">
                <h2 className="text-xs font-normal text-muted-foreground">
                  {GROUP_LABEL[group]}
                </h2>
                <ul className="flex flex-col divide-y divide-dashed divide-border">
                  {groupTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={(done) => toggle.mutate({ id: task.id, done })}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {showCompleted && completed.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-normal text-muted-foreground">
                Completed
              </h2>
              <ul className="flex flex-col divide-y divide-dashed divide-border">
                {completed.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(done) => toggle.mutate({ id: task.id, done })}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
