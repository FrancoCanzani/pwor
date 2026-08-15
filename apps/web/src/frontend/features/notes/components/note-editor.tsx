import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { WikiLinkEditorOptions } from "@features/notes/lib/cm-wiki-links";
import { createNoteEditorState } from "@features/notes/lib/cm-theme";
import { notesFingerprint } from "@features/notes/lib/wiki-links";

export function NoteEditor({
  initialDoc,
  placeholder = "Start writing…",
  onChange,
  uploadImage,
  wikiLinks,
  className,
  autoFocus = true,
}: {
  initialDoc: string;
  placeholder?: string;
  onChange: (value: string) => void;
  uploadImage?: (file: File) => Promise<{ url: string }>;
  wikiLinks?: WikiLinkEditorOptions;
  className?: string;
  autoFocus?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const uploadImageRef = useRef(uploadImage);
  const wikiLinksRef = useRef(wikiLinks);
  onChangeRef.current = onChange;
  uploadImageRef.current = uploadImage;
  wikiLinksRef.current = wikiLinks;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      state: createNoteEditorState({
        doc: initialDoc,
        placeholder,
        onChange: (value) => onChangeRef.current(value),
        uploadImage: uploadImageRef.current
          ? (file) => uploadImageRef.current!(file)
          : undefined,
        wikiLinks: wikiLinksRef.current
          ? {
              currentNoteId: wikiLinksRef.current.currentNoteId,
              getNotes: () => wikiLinksRef.current!.getNotes(),
              onOpenNote: (noteId) => wikiLinksRef.current!.onOpenNote(noteId),
            }
          : undefined,
      }),
      parent: host,
    });
    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // Remount when note changes (parent key includes noteId).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fingerprint = notesFingerprint(
    wikiLinks ? wikiLinks.getNotes() : undefined,
  );
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({});
  }, [fingerprint]);

  return (
    <div
      ref={hostRef}
      data-note-editor
      className={cn(
        "min-h-[60vh] w-full [&_.cm-editor]:min-h-[60vh]",
        className,
      )}
    />
  );
}
