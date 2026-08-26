import { Link, useNavigate, useParams } from "@tanstack/react-router";

import { LayoutSidebarTrigger } from "@/components/layout/layout-sidebar-trigger";
import { PageEmpty } from "@components/page-empty";
import {
  NoteDocumentBody,
  NoteSaveStatus,
  NoteTitleInput,
  useNoteDocument,
} from "@features/notes/components/note-document";

export function NotePage() {
  const { noteId } = useParams({ from: "/_app/notes/$noteId" });
  const navigate = useNavigate();
  const session = useNoteDocument(noteId);
  const {
    note,
    error,
    title,
    handleTitleChange,
    saveState,
    saveLabel,
    reloadFromServer,
  } = session;

  function openNote(id: string) {
    if (id === noteId) return;
    void navigate({ to: "/notes/$noteId", params: { noteId: id } });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <LayoutSidebarTrigger className="size-4 shrink-0 p-0 [&_svg]:size-3" />
        <Link
          to="/notes"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Notes
        </Link>
        <span className="min-w-0 flex-1" />
        {note ? (
          <NoteSaveStatus
            saveLabel={saveLabel}
            conflict={saveState === "conflict"}
            onReload={reloadFromServer}
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!note && error ? (
          <PageEmpty
            title="Note not found"
            description="It may have been deleted."
          />
        ) : note ? (
          <div className="mx-auto w-full max-w-2xl px-8 pt-10 pb-28 sm:px-16">
            <NoteTitleInput
              value={title}
              onChange={handleTitleChange}
              className="mb-8 w-full text-2xl leading-tight"
            />
            <NoteDocumentBody
              noteId={noteId}
              session={session}
              onOpenNote={openNote}
              className="pwor-editor-page min-h-[50vh]"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
