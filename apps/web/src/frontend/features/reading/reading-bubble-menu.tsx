import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import { getMarkRange, posToDOMRect } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function isOnReadingHighlight(editor: Editor): boolean {
  try {
    return !editor.isDestroyed && editor.isActive("readingHighlight");
  } catch {
    return false;
  }
}

export function activeHighlightNoteId(editor: Editor): string | null {
  try {
    if (!isOnReadingHighlight(editor)) return null;
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
  return isOnReadingHighlight(editor);
}

function toDOMRect(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): DOMRect {
  return new DOMRect(box.x, box.y, box.width, box.height);
}

function readingAnchorRect(editor: Editor): DOMRect {
  if (editor.isDestroyed || !editor.view.dom.parentNode) return new DOMRect();
  try {
    const { selection } = editor.state;
    const markType = editor.schema.marks.readingHighlight;
    if (selection.empty && markType && isOnReadingHighlight(editor)) {
      const range = getMarkRange(
        selection.$from,
        markType,
        editor.getAttributes("readingHighlight"),
      );
      if (range) {
        return toDOMRect(posToDOMRect(editor.view, range.from, range.to));
      }
    }
    return toDOMRect(
      posToDOMRect(editor.view, selection.from, selection.to),
    );
  } catch {
    return new DOMRect();
  }
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
  const [onMark, setOnMark] = useState(false);

  useEffect(() => {
    const update = () => {
      if (editor.isDestroyed) return;
      setActiveNoteId(activeHighlightNoteId(editor));
      setOnMark(isOnReadingHighlight(editor));
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  const getReferencedVirtualElement = useMemo(
    () => () => ({
      getBoundingClientRect: () => readingAnchorRect(editor),
      contextElement: editor.view.dom,
    }),
    [editor],
  );

  const options = useMemo(
    () => ({
      strategy: "fixed" as const,
      placement: "top" as const,
      offset: 8,
      flip: true,
      shift: { padding: 8 },
      onShow: () => {
        const popup = menuRef.current;
        if (!popup) return;
        stopAutoUpdateRef.current?.();
        const virtualEl = {
          getBoundingClientRect: () => readingAnchorRect(editor),
          contextElement: editor.view.dom,
        };
        stopAutoUpdateRef.current = autoUpdate(virtualEl, popup, () => {
          void computePosition(virtualEl, popup, {
            placement: "top",
            strategy: "fixed",
            middleware: [offset(8), flip(), shift({ padding: 8 })],
          }).then(({ x, y }) => {
            if (!popup.isConnected) return;
            popup.style.position = "fixed";
            popup.style.left = `${x}px`;
            popup.style.top = `${y}px`;
          });
        });
      },
      onHide: () => {
        stopAutoUpdateRef.current?.();
        stopAutoUpdateRef.current = null;
      },
    }),
    [editor],
  );

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      pluginKey="readingBubbleMenu"
      appendTo={() => document.body}
      shouldShow={shouldShowReadingMenu}
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={options}
      className="isolate z-50 flex items-stretch gap-0.5 rounded-md bg-popover p-0.5 ring-1 ring-foreground/10"
    >
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={pending || (onMark && !activeNoteId)}
        onClick={() => {
          if (activeNoteId) {
            onRemove(activeNoteId);
            return;
          }
          if (onMark) return;
          onHighlight();
        }}
      >
        {onMark ? "Remove" : "Highlight"}
      </Button>
      <Separator orientation="vertical" className="-my-0.5" />
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
