import { createFileRoute } from "@tanstack/react-router";

import { NotesLayout } from "@features/notes/components/notes-layout";

export const Route = createFileRoute("/_app/notes")({
  component: NotesLayout,
});
