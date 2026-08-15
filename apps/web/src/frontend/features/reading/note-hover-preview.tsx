import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { NoteListItem } from "@features/notes/api";
import { NOTED_MARK_SELECTOR } from "@lib/reading/highlight-mark";

const HIDE_MS = 150;

function markFromEvent(event: Event): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest(NOTED_MARK_SELECTOR);
}

export function NoteHoverPreview({
  root,
  notes,
  onOpen,
}: {
  root: HTMLElement | null;
  notes: NoteListItem[];
  onOpen: (noteId: string) => void;
}) {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = useState<{
    noteId: string;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    function clearHide() {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    }

    function scheduleHide() {
      clearHide();
      hideTimer.current = setTimeout(() => setHover(null), HIDE_MS);
    }

    function showFor(mark: HTMLElement) {
      const noteId = mark.getAttribute("data-highlight-note-id");
      if (!noteId) return;
      const note = notes.find((item) => item.id === noteId);
      if (!note?.hasBody || !note.bodyPreview) return;
      const rect = mark.getBoundingClientRect();
      const width = 288;
      const pad = 8;
      let left = rect.left;
      if (left + width > window.innerWidth - pad) {
        left = window.innerWidth - width - pad;
      }
      if (left < pad) left = pad;
      setHover({ noteId, left, top: rect.bottom + 8 });
    }

    function onOver(event: Event) {
      const mark = markFromEvent(event);
      if (!mark) return;
      clearHide();
      showFor(mark);
    }

    function onOut(event: Event) {
      const mark = markFromEvent(event);
      if (!mark) return;
      const related = (event as MouseEvent).relatedTarget;
      if (related instanceof Node && mark.contains(related)) return;
      scheduleHide();
    }

    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    return () => {
      clearHide();
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
    };
  }, [root, notes]);

  if (!hover) return null;
  const note = notes.find((item) => item.id === hover.noteId);
  if (!note?.bodyPreview) return null;

  return createPortal(
    <div
      className={cn(
        "fixed z-50 w-64 max-w-[calc(100vw-2rem)] cursor-pointer rounded-md border border-border bg-background p-2 text-xs",
      )}
      style={{ left: hover.left, top: hover.top }}
      onMouseEnter={() => {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }
      }}
      onMouseLeave={() => setHover(null)}
      onClick={() => onOpen(note.id)}
    >
      <p className="line-clamp-6 text-xs text-foreground">{note.bodyPreview}</p>
    </div>,
    document.body,
  );
}
