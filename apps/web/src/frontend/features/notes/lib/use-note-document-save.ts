import { documentsEqual, type DocumentJSON } from "@pwor/editor";
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
import { bodyToDocument } from "@features/notes/lib/legacy-document";
import {
  dropNotedFlag,
  inferTitleFromRaw,
  normalizeNoteTitle,
  noteBodyPreview,
  noteHasBody,
  noteIsNoted,
  serializeTiptapBody,
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
  const [title, setTitle] = useState("");

  const latestBodyRef = useRef<string | null>(null);
  const savedBodyRef = useRef<string | null>(null);
  const serverBodyRef = useRef<string | null>(null);
  const latestTitleRef = useRef<string | null>(null);
  const savedTitleRef = useRef<string | null>(null);
  const baseUpdatedAtRef = useRef<string | Date | number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const conflictRef = useRef(false);
  const keepNotedRef = useRef(false);
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;

  function applySavedNote(updated: Note) {
    savedBodyRef.current = dropNotedFlag(updated.body);
    serverBodyRef.current = updated.body;
    latestBodyRef.current = dropNotedFlag(updated.body);
    savedTitleRef.current = normalizeNoteTitle(updated.title);
    latestTitleRef.current = savedTitleRef.current;
    setTitle(savedTitleRef.current ?? "");
    baseUpdatedAtRef.current = updated.updatedAt;
    conflictRef.current = false;
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

    const editorBody = latestBodyRef.current;
    const expectedUpdatedAt = baseUpdatedAtRef.current;
    if (editorBody === null || expectedUpdatedAt == null) return;

    const body =
      keepNotedRef.current && !noteHasBody(editorBody)
        ? withNotedFlag(editorBody)
        : editorBody;
    const typedTitle = normalizeNoteTitle(latestTitleRef.current);
    const inferred = normalizeNoteTitle(inferTitleFromRaw(body).title);
    const nextTitle = typedTitle ?? inferred ?? savedTitleRef.current;
    const stored = serverBodyRef.current ?? savedBodyRef.current ?? "";
    const bodyChanged =
      body !== stored &&
      !documentsEqual(bodyToDocument(body), bodyToDocument(stored));
    const titleChanged = nextTitle !== savedTitleRef.current;
    if (!bodyChanged && !titleChanged) return;

    savingRef.current = true;
    setSaveState("saving");
    try {
      await saveMutation.mutateAsync({
        body,
        ...(titleChanged ? { title: nextTitle } : {}),
        expectedUpdatedAt: toEpochMs(expectedUpdatedAt),
      });
    } finally {
      savingRef.current = false;
      if (
        !conflictRef.current &&
        noteIdRef.current === noteId &&
        latestBodyRef.current !== null &&
        (latestBodyRef.current !== savedBodyRef.current ||
          normalizeNoteTitle(latestTitleRef.current) !== savedTitleRef.current)
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
    serverBodyRef.current = null;
    savedTitleRef.current = null;
    latestBodyRef.current = null;
    latestTitleRef.current = null;
    baseUpdatedAtRef.current = null;
    keepNotedRef.current = false;
    conflictRef.current = false;
    setTitle("");
    setSaveState("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [noteId]);

  useEffect(() => {
    if (!note) return;
    if (savedBodyRef.current === null) {
      const body = dropNotedFlag(note.body);
      savedBodyRef.current = body;
      serverBodyRef.current = note.body;
      latestBodyRef.current = body;
      savedTitleRef.current = normalizeNoteTitle(note.title);
      latestTitleRef.current = savedTitleRef.current;
      setTitle(savedTitleRef.current ?? "");
    }
    if (baseUpdatedAtRef.current === null) {
      baseUpdatedAtRef.current = note.updatedAt;
    }
    keepNotedRef.current = note.itemId != null || note.feedItemId != null;
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

  function handleDocumentChange(doc: DocumentJSON) {
    const saved = savedBodyRef.current ?? "";
    if (documentsEqual(doc, bodyToDocument(saved))) return;
    latestBodyRef.current = serializeTiptapBody(doc);
    scheduleSave();
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    latestTitleRef.current = value;
    scheduleSave();
  }

  function reloadFromServer() {
    if (!note) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    conflictRef.current = false;
    const body = dropNotedFlag(note.body);
    savedBodyRef.current = body;
    serverBodyRef.current = note.body;
    latestBodyRef.current = body;
    savedTitleRef.current = normalizeNoteTitle(note.title);
    latestTitleRef.current = savedTitleRef.current;
    setTitle(savedTitleRef.current ?? "");
    baseUpdatedAtRef.current = note.updatedAt;
    setSaveState("idle");
    setEditorNonce((n) => n + 1);
  }

  function initialDocument() {
    return bodyToDocument(latestBodyRef.current ?? note?.body ?? "");
  }

  return {
    saveState,
    editorNonce,
    title,
    handleTitleChange,
    handleDocumentChange,
    reloadFromServer,
    initialDocument,
  };
}

export function noteSaveLabel(state: NoteSaveState): string | null {
  switch (state) {
    case "idle":
      return null;
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    case "conflict":
      return "Edited elsewhere";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
