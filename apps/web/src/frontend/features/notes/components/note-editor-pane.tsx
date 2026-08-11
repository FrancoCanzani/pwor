import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  NoteConflictError,
  noteQueryOptions,
  notesQueryOptions,
  toEpochMs,
  updateNote,
  uploadNoteImage,
  type Note,
  type NoteListItem,
} from "@features/notes/api";
import { NoteEditor } from "@features/notes/components/note-editor";
import type { NoteEditorMode } from "@features/notes/lib/cm-theme";
import {
  inferTitleFromRaw,
  materializeNoteBody,
  normalizeNoteTitle,
  parseNoteDocument,
} from "../../../../shared/note-frontmatter";

const SAVE_DEBOUNCE_MS = 500;
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const { data: note, error } = useQuery(noteQueryOptions(noteId));
  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));

  const [mode, setMode] = useState<NoteEditorMode>(readEditorMode);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const [editorNonce, setEditorNonce] = useState(0);
  const [tags, setTags] = useState<string[]>([]);

  const latestBodyRef = useRef<string | null>(null);
  const savedBodyRef = useRef<string | null>(null);
  const savedTitleRef = useRef<string | null>(null);
  const baseUpdatedAtRef = useRef<string | Date | number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const conflictRef = useRef(false);
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;

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

  useEffect(() => {
    savedBodyRef.current = null;
    savedTitleRef.current = null;
    latestBodyRef.current = null;
    baseUpdatedAtRef.current = null;
    conflictRef.current = false;
    setTags([]);
    setSaveState("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [noteId]);

  useEffect(() => {
    if (!note) return;
    if (savedBodyRef.current === null) {
      const body = materializeNoteBody(note.body, note.title);
      savedBodyRef.current = body;
      latestBodyRef.current = body;
      savedTitleRef.current = normalizeNoteTitle(
        inferTitleFromRaw(body).title,
      );
      setTags(parseNoteDocument(body).tags);
    }
    if (baseUpdatedAtRef.current === null) {
      baseUpdatedAtRef.current = note.updatedAt;
    }
  }, [note]);

  function applySavedNote(updated: Note) {
    savedBodyRef.current = updated.body;
    savedTitleRef.current = updated.title ?? null;
    baseUpdatedAtRef.current = updated.updatedAt;
    conflictRef.current = false;
    setTags(parseNoteDocument(updated.body).tags);
    queryClient.setQueryData(noteQueryOptions(noteId).queryKey, updated);
    queryClient.setQueryData(
      notesQueryOptions(workspaceId).queryKey,
      (current: NoteListItem[] | undefined) => {
        if (!current) return current;
        const next = current.map((item) =>
          item.id === updated.id
            ? {
                id: updated.id,
                title: updated.title,
                workspaceId: updated.workspaceId,
                updatedAt: updated.updatedAt,
                createdAt: updated.createdAt,
              }
            : item,
        );
        return [...next].sort((a, b) => {
          const aTime = new Date(a.updatedAt).getTime();
          const bTime = new Date(b.updatedAt).getTime();
          return bTime - aTime;
        });
      },
    );
    setSaveState("saved");
  }

  const saveMutation = useMutation({
    mutationFn: (patch: {
      body?: string;
      title?: string | null;
      expectedUpdatedAt: string | Date | number;
    }) => updateNote(noteId, patch),
    onSuccess: (updated) => applySavedNote(updated),
    onError: (err) => {
      if (err instanceof NoteConflictError) {
        conflictRef.current = true;
        queryClient.setQueryData(noteQueryOptions(noteId).queryKey, err.note);
        setSaveState("conflict");
        return;
      }
      setSaveState("error");
    },
  });

  async function flushSave() {
    if (conflictRef.current || savingRef.current) return;
    if (noteIdRef.current !== noteId) return;

    const body = latestBodyRef.current;
    const expectedUpdatedAt = baseUpdatedAtRef.current;
    if (body === null || expectedUpdatedAt == null) return;

    const nextTitle = normalizeNoteTitle(inferTitleFromRaw(body).title);
    const bodyChanged = body !== savedBodyRef.current;
    const titleChanged = nextTitle !== savedTitleRef.current;
    if (!bodyChanged && !titleChanged) return;

    savingRef.current = true;
    setSaveState("saving");
    try {
      await saveMutation.mutateAsync({
        body,
        title: nextTitle,
        expectedUpdatedAt: toEpochMs(expectedUpdatedAt),
      });
    } catch {
    } finally {
      savingRef.current = false;
      if (
        !conflictRef.current &&
        noteIdRef.current === noteId &&
        latestBodyRef.current !== null &&
        (latestBodyRef.current !== savedBodyRef.current ||
          normalizeNoteTitle(inferTitleFromRaw(latestBodyRef.current).title) !==
            savedTitleRef.current)
      ) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void flushSave();
        }, SAVE_DEBOUNCE_MS);
      }
    }
  }

  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  useEffect(() => {
    function onHide() {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flushSaveRef.current();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") onHide();
    }

    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
      void flushSaveRef.current();
    };
  }, [noteId]);

  function scheduleSave() {
    if (conflictRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function handleBodyChange(value: string) {
    latestBodyRef.current = value;
    setTags(parseNoteDocument(value).tags);
    scheduleSave();
  }

  function reloadFromServer() {
    if (!note) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    conflictRef.current = false;
    const body = materializeNoteBody(note.body, note.title);
    savedBodyRef.current = body;
    latestBodyRef.current = body;
    savedTitleRef.current = normalizeNoteTitle(inferTitleFromRaw(body).title);
    baseUpdatedAtRef.current = note.updatedAt;
    setTags(parseNoteDocument(body).tags);
    setSaveState("idle");
    setEditorNonce((n) => n + 1);
  }

  if (!note) {
    if (error) {
      return <p className="text-xs text-destructive">Note not found.</p>;
    }
    return null;
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-3 px-3 md:px-8">
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
            initialDoc={latestBodyRef.current ?? materializeNoteBody(note.body, note.title)}
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
