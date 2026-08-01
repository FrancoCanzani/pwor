import { createFileRoute, redirect } from "@tanstack/react-router";

import { isMobileViewport } from "@/hooks/use-mobile";
import { notesQueryOptions } from "@features/notes/api";

export const Route = createFileRoute("/_app/$workspaceId/notes/")({
  beforeLoad: async ({ context, params }) => {
    if (isMobileViewport()) return;

    const notes = await context.queryClient.ensureQueryData(
      notesQueryOptions(params.workspaceId),
    );
    const latest = notes[0];
    if (!latest) return;

    throw redirect({
      to: "/$workspaceId/notes/$noteId",
      params: { workspaceId: params.workspaceId, noteId: latest.id },
      replace: true,
    });
  },
});
