import { useQuery } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  noteQueryOptions,
  notesQueryOptions,
  uploadNoteImage,
} from "@features/notes/api";
import { NoteEditor } from "@features/notes/components/note-editor";
import type { NoteEditorMode } from "@features/notes/lib/cm-theme";
import { useNoteDocumentSave } from "@features/notes/lib/use-note-document-save";

const EDITOR_MODE_KEY = "pwor-note-editor-mode";

function readEditorMode(): NoteEditorMode {
  try {
    const raw = localStorage.getItem(EDITOR_MODE_KEY);
    if (raw === "source" || raw === "preview") return raw;
  } catch {
    // privacy / unavailable storage
  }
  return "preview";
}

export function NoteEditorPane({ noteId }: { noteId: string }) {
  const navigate = useNavigate();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const { data: note, error } = useQuery(noteQueryOptions(noteId));
  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));
  const [mode, setMode] = useState<NoteEditorMode>(readEditorMode);

  const {
    saveState,
    tags,
    editorNonce,
    handleBodyChange,
    reloadFromServer,
    initialDoc,
  } = useNoteDocumentSave({ noteId, workspaceId, note });

  function setEditorMode(next: NoteEditorMode) {
    setMode(next);
    try {
      localStorage.setItem(EDITOR_MODE_KEY, next);
    } catch {
      // privacy / unavailable storage
    }
  }

  function toggleEditorMode() {
    setEditorMode(mode === "preview" ? "source" : "preview");
  }

  useHotkey("Mod+Alt+M", () => toggleEditorMode(), {
    enabled: note != null && saveState !== "conflict",
  });

  if (!note) {
    if (error) {
      return <p className="text-xs text-destructive">Note not found.</p>;
    }
    return null;
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/40 px-3 md:px-8">
        <div className="mx-auto flex min-w-0 w-full max-w-3xl items-center justify-end gap-3">
          {tags.length > 0 ? (
            <div className="min-w-0 flex-1 truncate text-[11px] leading-none text-muted-foreground">
              {tags.join(" · ")}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          <span className="shrink-0 text-[11px] leading-none text-muted-foreground">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : saveState === "conflict"
                    ? "Edited elsewhere"
                    : null}
          </span>
          {saveState === "conflict" ? (
            <Button
              type="button"
              variant="ghost"
              className="h-auto shrink-0 px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground"
              onClick={reloadFromServer}
            >
              Reload
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="h-auto shrink-0 px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground"
              onClick={toggleEditorMode}
              title="Toggle source / preview (⌘⌥M)"
            >
              {mode === "preview" ? "Source" : "Preview"}
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-20 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <NoteEditor
            key={`${note.id}:${mode}:${editorNonce}`}
            mode={mode}
            initialDoc={initialDoc()}
            onChange={handleBodyChange}
            uploadImage={(file) => uploadNoteImage(noteId, file)}
            wikiLinks={{
              currentNoteId: noteId,
              getNotes: () => notes,
              onOpenNote: (targetId) => {
                void navigate({
                  to: "/$workspaceId/notes/$noteId",
                  params: { workspaceId, noteId: targetId },
                });
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
