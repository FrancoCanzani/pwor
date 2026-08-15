import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  NoteConflictError,
  noteQueryOptions,
  updateNote,
  type Note,
  type NoteListItem,
} from "@features/notes/api";
import {
  inferTitleFromRaw,
  normalizeNoteTitle,
  noteBodyPreview,
  noteHasBody,
  noteIsNoted,
  parseNoteDocument,
  withNotedFlag,
} from "@shared/note-frontmatter";
import { toEpochMs } from "@shared/time";

const SAVE_DEBOUNCE_MS = 500;

export type NoteSaveState =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export function useNoteDocumentSave({
  noteId,
  note,
}: {
  noteId: string;
  note: Note | undefined;
}) {
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<NoteSaveState>("idle");
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

  function applySavedNote(updated: Note) {
    savedBodyRef.current = updated.body;
    savedTitleRef.current = updated.title ?? null;
    baseUpdatedAtRef.current = updated.updatedAt;
    conflictRef.current = false;
    setTags(parseNoteDocument(updated.body).tags);
    queryClient.setQueryData(noteQueryOptions(noteId).queryKey, updated);
    queryClient.setQueriesData(
      { queryKey: ["notes", "list"] },
      (current: NoteListItem[] | undefined) => {
        if (!current) return current;
        const next = current.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                title: updated.title,
                workspaceId: updated.workspaceId,
                updatedAt: updated.updatedAt,
                createdAt: updated.createdAt,
                hasBody: noteHasBody(updated.body),
                noted: noteIsNoted(updated.body),
                bodyPreview: noteBodyPreview(updated.body),
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
      const body = note.body;
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
    const saved = savedBodyRef.current ?? "";
    const next =
      noteIsNoted(saved) && !noteHasBody(value) ? withNotedFlag(value) : value;
    latestBodyRef.current = next;
    setTags(parseNoteDocument(next).tags);
    scheduleSave();
  }

  function reloadFromServer() {
    if (!note) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    conflictRef.current = false;
    const body = note.body;
    savedBodyRef.current = body;
    latestBodyRef.current = body;
    savedTitleRef.current = normalizeNoteTitle(inferTitleFromRaw(body).title);
    baseUpdatedAtRef.current = note.updatedAt;
    setTags(parseNoteDocument(body).tags);
    setSaveState("idle");
    setEditorNonce((n) => n + 1);
  }

  function initialDoc() {
    return latestBodyRef.current ?? (note ? note.body : "");
  }

  return {
    saveState,
    tags,
    editorNonce,
    handleBodyChange,
    reloadFromServer,
    initialDoc,
  };
}
