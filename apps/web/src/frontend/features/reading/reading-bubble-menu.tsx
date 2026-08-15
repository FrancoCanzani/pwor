import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import { posToDOMRect } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function activeHighlightNoteId(editor: Editor): string | null {
  try {
    if (editor.isDestroyed || !editor.schema) return null;
    if (!editor.isActive("readingHighlight")) return null;
    const noteId = editor.getAttributes("readingHighlight").noteId;
    return typeof noteId === "string" && noteId.length > 0 ? noteId : null;
  } catch {
    return null;
  }
}

function shouldShowReadingMenu({ editor }: { editor: Editor }): boolean {
  if (editor.isDestroyed) return false;
  const { selection, doc } = editor.state;
  if (!selection.empty) {
    return doc.textBetween(selection.from, selection.to).trim().length > 0;
  }
  return Boolean(activeHighlightNoteId(editor));
}

export function ReadingBubbleMenu({
  editor,
  onHighlight,
  onNote,
  onRemove,
  pending = false,
}: {
  editor: Editor;
  onHighlight: () => void;
  onNote: () => void;
  onRemove: (noteId: string) => void;
  pending?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const stopAutoUpdateRef = useRef<(() => void) | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      if (editor.isDestroyed) return;
      setActiveNoteId(activeHighlightNoteId(editor));
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  const virtualEl = {
    getBoundingClientRect: () => {
      try {
        const { from, to } = editor.state.selection;
        return posToDOMRect(editor.view, from, to);
      } catch {
        return new DOMRect();
      }
    },
    contextElement: editor.view.dom,
  };

  const onShow = () => {
    const popup = menuRef.current;
    if (!popup) return;
    stopAutoUpdateRef.current?.();
    stopAutoUpdateRef.current = autoUpdate(virtualEl, popup, () => {
      computePosition(virtualEl, popup, {
        placement: "top",
        strategy: "fixed",
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      })
        .then(({ x, y }) => {
          if (!popup.isConnected) return;
          popup.style.position = "fixed";
          popup.style.left = `${x}px`;
          popup.style.top = `${y}px`;
        })
        .catch(() => {});
    });
  };

  const onHide = () => {
    stopAutoUpdateRef.current?.();
    stopAutoUpdateRef.current = null;
  };

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      pluginKey="readingBubbleMenu"
      appendTo={() => document.body}
      shouldShow={shouldShowReadingMenu}
      updateDelay={0}
      options={{
        onShow,
        onHide,
        strategy: "fixed",
        offset: 8,
        flip: true,
        shift: { padding: 8 },
      }}
      className="isolate z-50 flex items-center gap-0.5 rounded-md bg-popover p-0.5 ring-1 ring-foreground/10"
    >
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={pending}
        onClick={() => {
          if (activeNoteId) {
            onRemove(activeNoteId);
            return;
          }
          onHighlight();
        }}
      >
        {activeNoteId ? "Remove" : "Highlight"}
      </Button>
      <Separator orientation="vertical" className="h-4" />
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={pending}
        onClick={onNote}
      >
        Note
      </Button>
    </BubbleMenu>
  );
}
