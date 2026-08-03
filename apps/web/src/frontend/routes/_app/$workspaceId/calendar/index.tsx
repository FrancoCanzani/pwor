import { createFileRoute } from "@tanstack/react-router";

import { CalendarPage } from "@features/calendar/components/calendar-page";

export const Route = createFileRoute("/_app/$workspaceId/calendar/")({
  component: CalendarPage,
});
