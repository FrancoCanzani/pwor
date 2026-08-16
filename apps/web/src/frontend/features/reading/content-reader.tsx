import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Superscript from "@tiptap/extension-superscript";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";
import {
  createNote,
  deleteNote,
  noteAnchor,
  passageIsNoted,
  targetNotesQueryOptions,
  type HighlightTarget,
  type NoteListItem,
} from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import { createAnchor, resolveAnchor } from "@lib/reading/highlight-anchor";
import {
  HighlightMark,
  NOTED_MARK_SELECTOR,
} from "@lib/reading/highlight-mark";

import { ArticleNotesMenu } from "./article-notes-menu";
import { NoteHoverPreview } from "./note-hover-preview";
import { prepareReaderHtml } from "./prepare-html";
import { PAINT_HIGHLIGHTS_META, ReadOnlyDocument } from "./read-only-document";
import {
  activeHighlightNoteId,
  ReadingBubbleMenu,
} from "./reading-bubble-menu";
import { ReadingVideo } from "./reading-video";

function resolvedRange(editor: Editor, note: NoteListItem) {
  const anchor = noteAnchor(note);
  if (!anchor) return null;
  return resolveAnchor(editor.state.doc, anchor);
}

function revealNote(editor: Editor, note: NoteListItem) {
  const resolved = resolvedRange(editor, note);
  if (resolved) {
    editor.chain().setTextSelection(resolved).scrollIntoView().run();
    return;
  }
  document
    .querySelector(`mark[data-highlight-note-id="${CSS.escape(note.id)}"]`)
    ?.scrollIntoView({ block: "center" });
}

function paintHighlights(
  editor: Editor,
  notes: NoteListItem[],
  activeNoteId: string | null,
) {
  if (editor.isDestroyed || !editor.schema) return;
  const markType = editor.schema.marks.readingHighlight;
  if (!markType) return;

  const { state } = editor;
  if (!state) return;

  let tr = state.tr.removeMark(0, state.doc.content.size, markType);
  for (const note of notes) {
    const resolved = resolvedRange(editor, note);
    if (!resolved) continue;
    tr = tr.addMark(
      resolved.from,
      resolved.to,
      markType.create({
        noteId: note.id,
        noted: passageIsNoted(note) || note.id === activeNoteId,
      }),
    );
  }
  if (tr.steps.length === 0) return;
  tr.setMeta("addToHistory", false);
  tr.setMeta(PAINT_HIGHLIGHTS_META, true);
  editor.view.dispatch(tr);
}

function upsertListedNote(queryClient: QueryClient, note: NoteListItem) {
  queryClient.setQueriesData<NoteListItem[]>(
    { queryKey: ["notes", "list"] },
    (current) => {
      if (!current) return [note];
      if (current.some((item) => item.id === note.id)) {
        return current.map((item) =>
          item.id === note.id ? { ...item, ...note } : item,
        );
      }
      return [note, ...current];
    },
  );
}

function promoteHighlightToNote(
  queryClient: QueryClient,
  editor: Editor,
  note: NoteListItem,
) {
  upsertListedNote(queryClient, { ...note, noted: true });
  editor.chain().setTextSelection(editor.state.selection.to).run();
}

export function ContentReader({
  target,
  content,
  className,
  contained = true,
  showNotesMenu = true,
  focusNoteId = null,
  onFocusHandled,
}: {
  target: HighlightTarget;
  content: string;
  className?: string;
  contained?: boolean;
  showNotesMenu?: boolean;
  focusNoteId?: string | null;
  onFocusHandled?: () => void;
}) {
  const queryClient = useQueryClient();
  const { openNote, activeNoteId } = useFloatingNote();
  const html = useMemo(() => prepareReaderHtml(content), [content]);

  const editor = useEditor(
    {
      editable: true,
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
        Link.configure({ openOnClick: true, autolink: true }),
        Superscript,
        Image,
        ReadingVideo,
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
        handleClick: (_view, _pos, event) => {
          const el = event.target;
          if (!(el instanceof Element)) return false;
          const mark = el.closest(NOTED_MARK_SELECTOR);
          if (!mark) return false;
          const noteId = mark.getAttribute("data-highlight-note-id");
          if (!noteId) return false;
          openNote(noteId);
          return true;
        },
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
      content: html,
    },
    [html],
  );

  const notesQuery = useQuery({
    ...targetNotesQueryOptions(target),
    enabled: content.length > 0,
  });
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const onFocusHandledRef = useRef(onFocusHandled);
  onFocusHandledRef.current = onFocusHandled;

  useEffect(() => {
    if (!editor) return;
    const paint = () => {
      if (editor.isDestroyed || !editor.state.selection.empty) return;
      paintHighlights(editor, notes, activeNoteId);
    };
    paint();
    editor.on("selectionUpdate", paint);
    return () => {
      editor.off("selectionUpdate", paint);
    };
  }, [editor, notes, activeNoteId]);

  useEffect(() => {
    if (!editor || !focusNoteId) return;
    const note = notes.find((item) => item.id === focusNoteId);
    if (note) revealNote(editor, note);
    onFocusHandledRef.current?.();
  }, [editor, focusNoteId, notes]);

  const saveMark = useMutation({
    mutationFn: async (mode: "highlight" | "note") => {
      if (!editor || editor.isDestroyed) throw new Error("Editor not ready");
      const { from, to } = editor.state.selection;
      const markType = editor.schema.marks.readingHighlight;
      if (markType) {
        const tr = editor.state.tr
          .addMark(
            from,
            to,
            markType.create({ noteId: "", noted: mode === "note" }),
          )
          .setMeta("addToHistory", false)
          .setMeta(PAINT_HIGHLIGHTS_META, true);
        editor.view.dispatch(tr);
      }
      const created = await createNote({
        target,
        anchor: createAnchor(editor.state.doc, from, to),
      });
      editor.chain().setTextSelection(to).run();
      return { created, mode };
    },
    onSuccess: ({ created, mode }) => {
      upsertListedNote(queryClient, {
        ...created,
        hasBody: false,
        noted: mode === "note",
        bodyPreview: null,
      });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      if (mode === "note") openNote(created.id);
    },
  });

  const removeHighlight = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  if (!content || !editor) return null;

  const pending = saveMark.isPending || removeHighlight.isPending;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <ReadingBubbleMenu
        editor={editor}
        pending={pending}
        onHighlight={() => saveMark.mutate("highlight")}
        onNote={() => {
          const noteId = activeHighlightNoteId(editor);
          if (!noteId) {
            saveMark.mutate("note");
            return;
          }
          const existing = notes.find((item) => item.id === noteId);
          if (existing && !passageIsNoted(existing)) {
            promoteHighlightToNote(queryClient, editor, existing);
          }
          openNote(noteId);
        }}
        onRemove={(noteId) => removeHighlight.mutate(noteId)}
      />
      {showNotesMenu ? (
        <ArticleNotesMenu
          className="mb-3 flex justify-end"
          notes={notes}
          onSelect={(note) => {
            revealNote(editor, note);
            if (passageIsNoted(note)) openNote(note.id);
          }}
        />
      ) : null}
      <div
        className={cn(
          contained && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        )}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-normal prose-a:font-normal prose-a:text-blue-600 prose-a:underline [&_sup]:ms-0.5 [&_sup_a]:font-normal [&_sup_a]:no-underline [&_mark.reading-highlight]:rounded-sm [&_mark.reading-highlight]:bg-[#fef08a] [&_mark.reading-highlight]:px-px [&_mark.reading-noted]:cursor-pointer [&_mark.reading-noted]:bg-transparent [&_mark.reading-noted]:underline [&_mark.reading-noted]:decoration-foreground/25 [&_mark.reading-noted]:decoration-dashed [&_mark.reading-noted]:underline-offset-2 [&_video.reading-video]:my-4 [&_video.reading-video]:w-full"
        />
      </div>
      <NoteHoverPreview
        root={editor.view.dom}
        notes={notes}
        onOpen={openNote}
      />
    </div>
  );
}
