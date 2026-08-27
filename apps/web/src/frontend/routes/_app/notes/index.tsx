import { createFileRoute } from "@tanstack/react-router";

import { notesQueryOptions } from "@features/notes/api";
import { NotesPage } from "@features/notes/components/notes-page";
import { getStoredSpaceId } from "@features/spaces/lib/current-space";

export const Route = createFileRoute("/_app/notes/")({
  loader: ({ context }) => {
    const spaceId = getStoredSpaceId();
    if (!spaceId) return;
    return context.queryClient.ensureQueryData(notesQueryOptions(spaceId));
  },
  component: NotesPage,
});
