import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  createNote,
  deleteNote,
  noteHasAnchor,
  targetNotesQueryOptions,
  type HighlightTarget,
  type NoteListItem,
} from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import { createAnchor, resolveAnchor } from "@lib/reading/highlight-anchor";
import { HighlightMark } from "@lib/reading/highlight-mark";

import { PAINT_HIGHLIGHTS_META, ReadOnlyDocument } from "./read-only-document";
import { ReadingBubbleMenu } from "./reading-bubble-menu";

function paintHighlights(editor: Editor, notes: NoteListItem[]) {
  if (editor.isDestroyed || !editor.schema) return;
  const markType = editor.schema.marks.readingHighlight;
  if (!markType) return;

  const { state } = editor;
  if (!state) return;

  let tr = state.tr.removeMark(0, state.doc.content.size, markType);
  for (const note of notes) {
    if (!noteHasAnchor(note)) continue;
    const resolved = resolveAnchor(state.doc, {
      from: note.anchorFrom,
      to: note.anchorTo,
      quote: note.anchorQuote,
      prefix: note.anchorPrefix ?? "",
      suffix: note.anchorSuffix ?? "",
    });
    if (!resolved) {
      console.warn("Could not resolve highlight", note.id);
      continue;
    }
    tr = tr.addMark(
      resolved.from,
      resolved.to,
      markType.create({ noteId: note.id }),
    );
  }
  if (tr.steps.length === 0) return;
  tr.setMeta("addToHistory", false);
  tr.setMeta(PAINT_HIGHLIGHTS_META, true);
  editor.view.dispatch(tr);
}

export function ContentReader({
  target,
  content,
  className,
  contained = true,
}: {
  target: HighlightTarget;
  content: string;
  className?: string;
  contained?: boolean;
}) {
  const queryClient = useQueryClient();
  const { openNote } = useFloatingNote();

  const editor = useEditor(
    {
      editable: true,
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: true, autolink: true }),
        Image,
        HighlightMark,
        ReadOnlyDocument,
      ],
      editorProps: {
        attributes: {
          spellcheck: "false",
          class: "caret-transparent outline-none",
        },
        handleTextInput: () => true,
        handlePaste: () => true,
        handleDrop: () => true,
        handleKeyDown: (_view, event) => {
          if (event.metaKey || event.ctrlKey) return false;
          if (
            event.key === "Backspace" ||
            event.key === "Delete" ||
            event.key === "Enter" ||
            event.key === "Tab" ||
            event.key.length === 1
          ) {
            return true;
          }
          return false;
        },
      },
      content,
    },
    [content],
  );

  const notesQuery = useQuery({
    ...targetNotesQueryOptions(target),
    enabled: content.length > 0,
  });
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);

  useEffect(() => {
    if (!editor) return;
    paintHighlights(editor, notes);
  }, [editor, notes]);

  const saveHighlight = useMutation({
    mutationFn: async (open: boolean) => {
      if (!editor || editor.isDestroyed) throw new Error("Editor not ready");
      const { from, to } = editor.state.selection;
      const created = await createNote({
        target,
        anchor: createAnchor(editor.state.doc, from, to),
      });
      return { created, open };
    },
    onSuccess: ({ created, open }) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      if (open) openNote(created.id);
    },
  });

  const removeHighlight = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  if (!content || !editor) return null;

  const pending = saveHighlight.isPending || removeHighlight.isPending;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <ReadingBubbleMenu
        editor={editor}
        pending={pending}
        onHighlight={() => saveHighlight.mutate(false)}
        onNote={() => {
          try {
            if (editor.isActive("readingHighlight")) {
              const noteId = editor.getAttributes("readingHighlight").noteId;
              if (typeof noteId === "string" && noteId.length > 0) {
                openNote(noteId);
                return;
              }
            }
          } catch {
            // TipTap can throw at doc-boundary cursor positions.
          }
          saveHighlight.mutate(true);
        }}
        onRemove={(noteId) => removeHighlight.mutate(noteId)}
      />
      <div
        className={cn(
          contained && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        )}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-normal prose-a:text-foreground"
        />
      </div>
    </div>
  );
}
