import { createFileRoute } from "@tanstack/react-router";

import { notesQueryOptions } from "@features/notes/api";
import { NotesPage } from "@features/notes/components/notes-page";
import { getStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";

export const Route = createFileRoute("/_app/notes/")({
  loader: ({ context }) => {
    const workspaceId = getStoredWorkspaceId();
    if (!workspaceId) return;
    return context.queryClient.ensureQueryData(notesQueryOptions(workspaceId));
  },
  component: NotesPage,
});
