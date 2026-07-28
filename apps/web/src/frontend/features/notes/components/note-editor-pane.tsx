import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  noteQueryOptions,
  notesQueryOptions,
  updateNote,
  uploadNoteImage,
  type NoteListItem,
} from "@features/notes/api";
import { NoteEditor } from "@features/notes/components/note-editor";

const SAVE_DEBOUNCE_MS = 500;

export function NoteEditorPane({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const { data: note, error } = useQuery(noteQueryOptions(noteId));

  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const latestBodyRef = useRef<string | null>(null);
  const latestTitleRef = useRef<string | null>(null);
  const savedBodyRef = useRef<string | null>(null);
  const savedTitleRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    savedBodyRef.current = null;
    savedTitleRef.current = null;
    latestBodyRef.current = null;
    latestTitleRef.current = null;
    setTitle("");
    setSaveState("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [noteId]);

  useEffect(() => {
    if (!note) return;
    if (savedBodyRef.current === null) {
      savedBodyRef.current = note.body;
      latestBodyRef.current = note.body;
    }
    if (savedTitleRef.current === null) {
      const nextTitle = note.title ?? "";
      savedTitleRef.current = nextTitle;
      latestTitleRef.current = nextTitle;
      setTitle(nextTitle);
    }
  }, [note]);

  const saveMutation = useMutation({
    mutationFn: (patch: { body?: string; title?: string | null }) =>
      updateNote(noteId, patch),
    onSuccess: (updated) => {
      savedBodyRef.current = updated.body;
      savedTitleRef.current = updated.title ?? "";
      queryClient.setQueryData(noteQueryOptions(noteId).queryKey, updated);
      queryClient.setQueryData(
        notesQueryOptions.queryKey,
        (current: NoteListItem[] | undefined) => {
          if (!current) return current;
          const next = current.map((item) =>
            item.id === updated.id
              ? {
                  id: updated.id,
                  title: updated.title,
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
    },
    onError: () => setSaveState("error"),
  });

  async function flushSave() {
    const body = latestBodyRef.current;
    const nextTitle = latestTitleRef.current;
    if (body === null || nextTitle === null || savingRef.current) return;

    const bodyChanged = body !== savedBodyRef.current;
    const titleChanged = nextTitle !== savedTitleRef.current;
    if (!bodyChanged && !titleChanged) return;

    savingRef.current = true;
    setSaveState("saving");
    try {
      await saveMutation.mutateAsync({
        ...(bodyChanged ? { body } : {}),
        ...(titleChanged ? { title: nextTitle } : {}),
      });
    } finally {
      savingRef.current = false;
      if (
        latestBodyRef.current !== null &&
        latestTitleRef.current !== null &&
        (latestBodyRef.current !== savedBodyRef.current ||
          latestTitleRef.current !== savedTitleRef.current)
      ) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void flushSave();
        }, SAVE_DEBOUNCE_MS);
      }
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function handleBodyChange(value: string) {
    latestBodyRef.current = value;
    scheduleSave();
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    latestTitleRef.current = value;
    scheduleSave();
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
        <div className="mx-auto flex min-w-0 w-full max-w-3xl items-center gap-3">
          <Input
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="Title"
            className="h-auto border-0 px-0 py-0 text-sm leading-none font-normal shadow-none focus-visible:border-transparent focus-visible:ring-0"
          />
          <span className="shrink-0 text-[11px] leading-none text-muted-foreground">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : null}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-20 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <NoteEditor
            key={note.id}
            initialDoc={note.body}
            onChange={handleBodyChange}
            uploadImage={(file) => uploadNoteImage(noteId, file)}
          />
        </div>
      </div>
    </div>
  );
}
