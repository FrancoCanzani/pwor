import { createFileRoute } from "@tanstack/react-router";

import { TasksPage } from "@features/tasks/components/tasks-page";

export const Route = createFileRoute("/_app/$workspaceId/tasks/")({
  component: TasksPage,
});
