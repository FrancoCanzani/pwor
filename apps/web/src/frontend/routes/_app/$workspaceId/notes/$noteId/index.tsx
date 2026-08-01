import { createFileRoute } from "@tanstack/react-router";

import { NoteEditorPane } from "@features/notes/components/note-editor-pane";

export const Route = createFileRoute("/_app/$workspaceId/notes/$noteId/")({
  component: NoteDetailRoute,
});

function NoteDetailRoute() {
  const { noteId } = Route.useParams();
  return <NoteEditorPane noteId={noteId} />;
}
