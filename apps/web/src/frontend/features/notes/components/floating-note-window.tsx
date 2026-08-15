import { Cross2Icon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  noteQueryOptions,
  notesQueryOptions,
  uploadNoteImage,
  type Note,
} from "@features/notes/api";
import { NoteEditor } from "@features/notes/components/note-editor";
import { useFloatingNote } from "@features/notes/floating-note-context";
import { useNoteDocumentSave } from "@features/notes/lib/use-note-document-save";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 520;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 240;

function defaultPosition() {
  if (typeof window === "undefined") {
    return { x: 80, y: 80 };
  }
  const x = Math.max(24, Math.round(window.innerWidth / 2 - DEFAULT_WIDTH / 2));
  const y = Math.max(24, Math.round(window.innerHeight / 2 - DEFAULT_HEIGHT / 2));
  return { x, y };
}

export function FloatingNoteHost({
  noteId,
  onClose,
}: {
  noteId: string;
  onClose: () => void;
}) {
  return createPortal(
    <FloatingNoteShell onClose={onClose}>
      <FloatingNoteContent key={noteId} noteId={noteId} onClose={onClose} />
    </FloatingNoteShell>,
    document.body,
  );
}

function FloatingNoteShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [pos, setPos] = useState(defaultPosition);
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell || shell.dataset.sized === "1") return;
    if (isMobile) {
      shell.style.width = "";
      shell.style.height = "";
      return;
    }
    shell.style.width = `${DEFAULT_WIDTH}px`;
    shell.style.height = `${DEFAULT_HEIGHT}px`;
    shell.dataset.sized = "1";
  }, [isMobile]);

  useHotkey("Escape", () => onClose(), { enabled: true });

  function onDragPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (isMobile) return;
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (!target?.closest("[data-floating-note-drag]")) return;
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDragPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (isMobile) return;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = drag.originX + (event.clientX - drag.startX);
    const nextY = drag.originY + (event.clientY - drag.startY);
    const maxX = Math.max(0, window.innerWidth - MIN_WIDTH);
    const maxY = Math.max(0, window.innerHeight - 48);
    setPos({
      x: Math.min(Math.max(0, nextX), maxX),
      y: Math.min(Math.max(0, nextY), maxY),
    });
  }

  function onDragPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={shellRef}
      role="dialog"
      aria-label="Note"
      className={cn(
        "fixed z-50 flex min-h-0 min-w-0 flex-col overflow-hidden bg-background",
        isMobile
          ? "inset-0 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
          : "resize rounded-md border border-border shadow-[0_16px_48px_rgba(0,0,0,0.14)] ring-1 ring-black/5",
      )}
      style={
        isMobile
          ? undefined
          : {
              left: pos.x,
              top: pos.y,
              minWidth: MIN_WIDTH,
              minHeight: MIN_HEIGHT,
            }
      }
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
      onPointerCancel={onDragPointerUp}
    >
      {children}
    </div>
  );
}

function NoteChrome({
  saveLabel,
  conflict,
  onClose,
  onReload,
  children,
}: {
  saveLabel: string | null;
  conflict: boolean;
  onClose: () => void;
  onReload?: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <>
      <div
        data-floating-note-drag
        className={cn(
          "flex h-9 shrink-0 items-center gap-2 px-2",
          !isMobile &&
            "cursor-grab border-b border-border/40 active:cursor-grabbing",
        )}
      >
        {isMobile ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="shrink-0 font-normal"
            onClick={onClose}
          >
            Back
          </Button>
        ) : null}
        <span className="min-w-0 flex-1" />
        {saveLabel ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {saveLabel}
          </span>
        ) : null}
        {conflict ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto shrink-0 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
            onClick={onReload}
          >
            Reload
          </Button>
        ) : null}
        {!isMobile ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close note"
            className="shrink-0"
            onClick={onClose}
          >
            <Cross2Icon />
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
        {children}
      </div>
    </>
  );
}

function FloatingNoteContent({
  noteId,
  onClose,
}: {
  noteId: string;
  onClose: () => void;
}) {
  const { openNote } = useFloatingNote();
  const { id: workspaceId } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const cached = queryClient.getQueryData<Note>(
    noteQueryOptions(noteId).queryKey,
  );
  const { data: note, error } = useQuery({
    ...noteQueryOptions(noteId),
    initialData: cached,
    initialDataUpdatedAt: queryClient.getQueryState(
      noteQueryOptions(noteId).queryKey,
    )?.dataUpdatedAt,
  });
  const { data: notes = [] } = useQuery({
    ...notesQueryOptions(workspaceId ?? undefined),
    enabled: Boolean(workspaceId),
  });

  const {
    saveState,
    editorNonce,
    handleBodyChange,
    reloadFromServer,
    initialDoc,
  } = useNoteDocumentSave({
    noteId,
    workspaceId: workspaceId ?? "",
    note,
  });

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : saveState === "conflict"
            ? "Edited elsewhere"
            : null;

  return (
    <NoteChrome
      saveLabel={saveLabel}
      conflict={saveState === "conflict"}
      onClose={onClose}
      onReload={reloadFromServer}
    >
      {note ? (
        <NoteEditor
          key={`${note.id}:${editorNonce}`}
          initialDoc={initialDoc()}
          onChange={handleBodyChange}
          uploadImage={(file) => uploadNoteImage(noteId, file)}
          className="min-h-full [&_.cm-editor]:min-h-[12rem]"
          wikiLinks={
            workspaceId
              ? {
                  currentNoteId: noteId,
                  getNotes: () => notes,
                  onOpenNote: (targetId) => {
                    openNote(targetId);
                  },
                }
              : undefined
          }
        />
      ) : error ? (
        <p className="text-xs text-destructive">Note not found.</p>
      ) : null}
    </NoteChrome>
  );
}
