import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isStandaloneNote,
  noteQueryOptions,
  notesQueryOptions,
  uploadNoteImage,
  type Note,
} from "@features/notes/api";
import { NoteEditor } from "@features/notes/components/note-editor";
import {
  noteSaveLabel,
  useNoteDocumentSave,
} from "@features/notes/lib/use-note-document-save";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

export function useNoteDocument(noteId: string) {
  const { id: workspaceId } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const cached = queryClient.getQueryData<Note>(
    noteQueryOptions(noteId).queryKey,
  );
  const { data: note, error } = useQuery({
    ...noteQueryOptions(noteId),
    initialData: cached,
    initialDataUpdatedAt: queryClient.getQueryState(
      noteQueryOptions(noteId).queryKey,
    )?.dataUpdatedAt,
  });
  const mentionWorkspaceId = note?.workspaceId ?? workspaceId;
  const { data: notes = [] } = useQuery({
    ...notesQueryOptions(mentionWorkspaceId ?? undefined),
    enabled: Boolean(mentionWorkspaceId),
  });

  const save = useNoteDocumentSave({
    noteId,
    note,
  });

  return {
    note,
    error,
    notes,
    mentionWorkspaceId,
    saveLabel: noteSaveLabel(save.saveState),
    ...save,
  };
}

export type NoteDocumentSession = ReturnType<typeof useNoteDocument>;

export function NoteTitleInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Untitled"
      aria-label="Note title"
      className={cn(
        "min-w-0 flex-1 bg-transparent font-normal outline-none placeholder:text-muted-foreground",
        className,
      )}
    />
  );
}

export function NoteSaveStatus({
  saveLabel,
  conflict,
  onReload,
}: {
  saveLabel: string | null;
  conflict: boolean;
  onReload: () => void;
}) {
  return (
    <>
      {saveLabel ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {saveLabel}
        </span>
      ) : null}
      {conflict ? (
        <Button
          type="button"
          variant="ghost"
          className="h-auto shrink-0 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
          onClick={onReload}
        >
          Reload
        </Button>
      ) : null}
    </>
  );
}

export function NoteDocumentBody({
  noteId,
  session,
  onOpenNote,
  autoFocus = true,
  className,
}: {
  noteId: string;
  session: NoteDocumentSession;
  onOpenNote: (noteId: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const {
    note,
    error,
    notes,
    mentionWorkspaceId,
    editorNonce,
    handleDocumentChange,
    initialDocument,
  } = session;

  if (!note) {
    return error ? (
      <p className="text-xs text-destructive">Note not found.</p>
    ) : null;
  }

  return (
    <NoteEditor
      key={`${note.id}:${editorNonce}`}
      initialDocument={initialDocument()}
      onChange={handleDocumentChange}
      autoFocus={autoFocus}
      uploadImage={(file) =>
        uploadNoteImage(noteId, file).then((image) => ({ src: image.url }))
      }
      className={cn("min-h-full", className)}
      mentions={
        mentionWorkspaceId
          ? {
              currentNoteId: noteId,
              getNotes: () => notes.filter(isStandaloneNote),
              onOpenNote,
            }
          : undefined
      }
    />
  );
}

export function NoteDocument({
  noteId,
  onOpenNote,
  autoFocus = true,
  showTitle = true,
  className,
}: {
  noteId: string;
  onOpenNote: (noteId: string) => void;
  autoFocus?: boolean;
  showTitle?: boolean;
  className?: string;
}) {
  const session = useNoteDocument(noteId);
  const { title, handleTitleChange, saveState, saveLabel, reloadFromServer } =
    session;

  return (
    <div className={cn("flex min-h-full flex-col gap-2", className)}>
      {showTitle ? (
        <div className="flex items-baseline gap-2">
          <NoteTitleInput
            value={title}
            onChange={handleTitleChange}
            className="text-base"
          />
          <NoteSaveStatus
            saveLabel={saveLabel}
            conflict={saveState === "conflict"}
            onReload={reloadFromServer}
          />
        </div>
      ) : null}
      <NoteDocumentBody
        noteId={noteId}
        session={session}
        onOpenNote={onOpenNote}
        autoFocus={autoFocus}
      />
    </div>
  );
}
