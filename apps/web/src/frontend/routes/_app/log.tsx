import { createFileRoute } from "@tanstack/react-router";

import { WorkLogPage } from "@features/work-log/components/work-log-page";

export const Route = createFileRoute("/_app/log")({
  component: WorkLogPage,
});
