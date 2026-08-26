import { createFileRoute } from "@tanstack/react-router";

import { NotePage } from "@features/notes/components/note-page";

export const Route = createFileRoute("/_app/notes/$noteId")({
  component: NotePage,
});
