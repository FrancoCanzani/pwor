import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Markdown } from "tiptap-markdown";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createHighlight,
  deleteNote,
  highlightsQueryOptions,
  type HighlightTarget,
} from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import { createAnchor, resolveAnchor } from "@lib/reading/highlight-anchor";
import { HIGHLIGHT_COLOR } from "@lib/reading/highlight-colors";
import { HighlightMark } from "@lib/reading/highlight-mark";

export function ContentReader({
  target,
  markdown,
  html,
  className,
  contained = true,
}: {
  target: HighlightTarget;
  markdown?: string | null;
  html?: string | null;
  className?: string;
  contained?: boolean;
}) {
  const queryClient = useQueryClient();
  const { openNote } = useFloatingNote();
  const source = markdown ?? html ?? "";
  const isMarkdown = markdown != null;

  const editor = useEditor(
    {
      editable: false,
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: true, autolink: true }),
        Image,
        HighlightMark,
        ...(isMarkdown ? [Markdown.configure({ html: false, breaks: false })] : []),
      ],
      content: source,
    },
    [source, isMarkdown],
  );

  const [hasSelection, setHasSelection] = useState(false);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      setHasSelection(!editor.state.selection.empty);
      // isActive/getAttributes can throw on certain doc-boundary cursor
      // positions (TipTap reads a node that resolves to null there).
      try {
        const active = editor.isActive("readingHighlight");
        const attrs = editor.getAttributes("readingHighlight") as {
          noteId?: string;
        };
        setActiveHighlightId(active ? (attrs.noteId ?? null) : null);
      } catch {
        setActiveHighlightId(null);
      }
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  const highlightsQuery = useQuery({
    ...highlightsQueryOptions(target),
    enabled: Boolean(source),
  });
  const highlights = useMemo(
    () => highlightsQuery.data ?? [],
    [highlightsQuery.data],
  );

  useEffect(() => {
    if (!editor) return;
    const { state, schema } = editor;
    const markType = schema.marks.readingHighlight;
    if (!markType) return;

    let tr = state.tr.removeMark(0, state.doc.content.size, markType);
    for (const highlight of highlights) {
      const resolved = resolveAnchor(state.doc, {
        from: highlight.anchorFrom,
        to: highlight.anchorTo,
        quote: highlight.anchorQuote,
        prefix: highlight.anchorPrefix,
        suffix: highlight.anchorSuffix,
        patch: highlight.anchorPatch,
      });
      if (!resolved) continue;
      tr = tr.addMark(
        resolved.from,
        resolved.to,
        markType.create({ noteId: highlight.id }),
      );
    }
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  }, [editor, highlights]);

  function invalidateHighlights() {
    void queryClient.invalidateQueries({
      queryKey: highlightsQueryOptions(target).queryKey,
    });
  }

  const addHighlight = useMutation({
    mutationFn: () => {
      const { from, to } = editor!.state.selection;
      const anchor = createAnchor(editor!.state.doc, from, to);
      return createHighlight({ target, anchor, color: HIGHLIGHT_COLOR });
    },
    onSuccess: invalidateHighlights,
  });

  const addHighlightForNote = useMutation({
    mutationFn: () => {
      const { from, to } = editor!.state.selection;
      const anchor = createAnchor(editor!.state.doc, from, to);
      return createHighlight({ target, anchor, color: HIGHLIGHT_COLOR });
    },
    onSuccess: (created) => {
      invalidateHighlights();
      openNote(created.id);
    },
  });

  const removeHighlight = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: invalidateHighlights,
  });

  if (!source || !editor) return null;

  const canAct = hasSelection || Boolean(activeHighlightId);

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!canAct}
          onClick={() => {
            if (activeHighlightId) {
              removeHighlight.mutate(activeHighlightId);
              return;
            }
            addHighlight.mutate();
          }}
        >
          Highlight
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!canAct}
          onClick={() => {
            if (activeHighlightId) {
              openNote(activeHighlightId);
              return;
            }
            addHighlightForNote.mutate();
          }}
        >
          Note
        </Button>
      </div>
      <div
        className={cn(
          contained && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        )}
        onClick={(event) => {
          const mark = (event.target as HTMLElement).closest(
            "mark[data-highlight-note-id]",
          );
          const noteId = mark?.getAttribute("data-highlight-note-id");
          if (noteId) openNote(noteId);
        }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-medium prose-a:text-foreground"
        />
      </div>
    </div>
  );
}
