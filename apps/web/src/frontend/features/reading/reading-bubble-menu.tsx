import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function activeHighlightNoteId(editor: Editor): string | null {
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

function selectionRect(): DOMRect {
  try {
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width || rect.height || rect.top || rect.left) return rect;
    }
  } catch {
    // Range can detach when highlight marks rewrite the DOM.
  }
  return new DOMRect();
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

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="readingBubbleMenu"
      appendTo={() => document.body}
      shouldShow={shouldShowReadingMenu}
      updateDelay={50}
      getReferencedVirtualElement={() => ({
        getBoundingClientRect: selectionRect,
        contextElement: editor.view.dom,
      })}
      options={{
        strategy: "fixed",
        offset: 8,
        flip: true,
        shift: { padding: 8 },
      }}
      className="isolate z-50 flex items-stretch gap-0.5 rounded-md bg-popover p-0.5 ring-1 ring-foreground/10"
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
