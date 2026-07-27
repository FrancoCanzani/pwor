import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { createNoteEditorState } from "@features/notes/lib/cm-theme";

export function NoteEditor({
  initialDoc,
  placeholder = "Start writing…",
  onChange,
  uploadImage,
  className,
  autoFocus = true,
}: {
  initialDoc: string;
  placeholder?: string;
  onChange: (value: string) => void;
  uploadImage?: (file: File) => Promise<{ url: string }>;
  className?: string;
  autoFocus?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const uploadImageRef = useRef(uploadImage);
  onChangeRef.current = onChange;
  uploadImageRef.current = uploadImage;

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
      }),
      parent: host,
    });

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
    };
    // Mount once per note (parent remounts via key={noteId}).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
