import { Cross2Icon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createNote,
  noteQueryOptions,
  notesQueryOptions,
  uploadNoteImage,
  type Note,
  type NoteListItem,
} from "@features/notes/api";
import { NoteEditor } from "@features/notes/components/note-editor";
import { useFloatingNote } from "@features/notes/floating-note-context";
import type { NoteEditorMode } from "@features/notes/lib/cm-theme";
import { useNoteDocumentSave } from "@features/notes/lib/use-note-document-save";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";
import { EMPTY_NOTE_BODY } from "@shared/note-frontmatter";

const EDITOR_MODE_KEY = "pwor-note-editor-mode";
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 520;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 240;

function readEditorMode(): NoteEditorMode {
  try {
    const raw = localStorage.getItem(EDITOR_MODE_KEY);
    if (raw === "source" || raw === "preview") return raw;
  } catch {
    // privacy / unavailable storage
  }
  return "preview";
}

function defaultPosition() {
  if (typeof window === "undefined") {
    return { x: 80, y: 80 };
  }
  const x = Math.max(24, Math.round(window.innerWidth / 2 - DEFAULT_WIDTH / 2));
  const y = Math.max(24, Math.round(window.innerHeight / 2 - DEFAULT_HEIGHT / 2));
  return { x, y };
}

/** UI-only label when the note has no real title yet. */
function displayTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  if (!trimmed || trimmed === "tags: []") return "Untitled";
  return trimmed;
}

function seedNotesList(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  note: Note,
) {
  const item: NoteListItem = {
    id: note.id,
    title: note.title,
    workspaceId: note.workspaceId,
    updatedAt: note.updatedAt,
    createdAt: note.createdAt,
  };
  queryClient.setQueryData(
    notesQueryOptions(workspaceId).queryKey,
    (current: NoteListItem[] | undefined) => {
      if (!current) return [item];
      return [item, ...current.filter((row) => row.id !== note.id)];
    },
  );
}

export function FloatingNoteHost({
  noteId,
  onClose,
  onOpened,
}: {
  noteId: string | null;
  onClose: () => void;
  onOpened: (noteId: string) => void;
}) {
  const { id: workspaceId } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);
  const draftBodyRef = useRef(EMPTY_NOTE_BODY);
  const onCloseRef = useRef(onClose);
  const onOpenedRef = useRef(onOpened);
  onCloseRef.current = onClose;
  onOpenedRef.current = onOpened;

  useEffect(() => {
    if (noteId || !workspaceId || creatingRef.current) return;
    creatingRef.current = true;
    draftBodyRef.current = EMPTY_NOTE_BODY;

    void createNote(EMPTY_NOTE_BODY, null, workspaceId)
      .then((note) => {
        const body = draftBodyRef.current;
        const seeded: Note = { ...note, body };
        queryClient.setQueryData(noteQueryOptions(note.id).queryKey, seeded);
        seedNotesList(queryClient, workspaceId, seeded);
        onOpenedRef.current(note.id);
      })
      .catch(() => {
        toast.error("Couldn’t create note");
        onCloseRef.current();
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [noteId, workspaceId, queryClient]);

  return createPortal(
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-[1px]"
      />
      <FloatingNoteShell onClose={onClose}>
        {noteId ? (
          <FloatingNoteContent key={noteId} noteId={noteId} onClose={onClose} />
        ) : (
          <FloatingNoteDraft
            draftBodyRef={draftBodyRef}
            onClose={onClose}
          />
        )}
      </FloatingNoteShell>
    </>,
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
    shell.style.width = `${DEFAULT_WIDTH}px`;
    shell.style.height = `${DEFAULT_HEIGHT}px`;
    shell.dataset.sized = "1";
  }, []);

  useHotkey("Escape", () => onClose(), { enabled: true });

  function onDragPointerDown(event: ReactPointerEvent<HTMLElement>) {
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
      className="fixed z-50 flex min-h-0 min-w-0 resize flex-col overflow-hidden rounded-md border border-border bg-background shadow-[0_16px_48px_rgba(0,0,0,0.14)] ring-1 ring-black/5"
      style={{
        left: pos.x,
        top: pos.y,
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
      }}
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
  title,
  saveLabel,
  mode,
  conflict,
  onClose,
  onToggleMode,
  onReload,
  children,
}: {
  title: string;
  saveLabel: string | null;
  mode: NoteEditorMode;
  conflict: boolean;
  onClose: () => void;
  onToggleMode: () => void;
  onReload?: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div
        data-floating-note-drag
        className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-border/40 px-2 active:cursor-grabbing"
      >
        <span className="min-w-0 flex-1 truncate text-[11px] font-normal">
          {title}
        </span>
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
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="h-auto shrink-0 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
            onClick={onToggleMode}
            title="Toggle source / preview (⌘⌥M)"
          >
            {mode === "preview" ? "Source" : "Preview"}
          </Button>
        )}
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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
        {children}
      </div>
    </>
  );
}

function useEditorMode() {
  const [mode, setMode] = useState<NoteEditorMode>(readEditorMode);

  function setEditorMode(next: NoteEditorMode) {
    setMode(next);
    try {
      localStorage.setItem(EDITOR_MODE_KEY, next);
    } catch {
      // privacy / unavailable storage
    }
  }

  function toggleEditorMode() {
    setEditorMode(mode === "preview" ? "source" : "preview");
  }

  return { mode, toggleEditorMode };
}

function FloatingNoteDraft({
  draftBodyRef,
  onClose,
}: {
  draftBodyRef: MutableRefObject<string>;
  onClose: () => void;
}) {
  const { mode, toggleEditorMode } = useEditorMode();
  const [body, setBody] = useState(EMPTY_NOTE_BODY);

  useHotkey("Mod+Alt+M", () => toggleEditorMode());

  return (
    <NoteChrome
      title="Untitled"
      saveLabel={null}
      mode={mode}
      conflict={false}
      onClose={onClose}
      onToggleMode={toggleEditorMode}
    >
      <NoteEditor
        key={`draft:${mode}`}
        mode={mode}
        initialDoc={body}
        onChange={(value) => {
          setBody(value);
          draftBodyRef.current = value;
        }}
        className="min-h-full [&_.cm-editor]:min-h-[12rem]"
      />
    </NoteChrome>
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
  const { mode, toggleEditorMode } = useEditorMode();

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

  useHotkey("Mod+Alt+M", () => toggleEditorMode(), {
    enabled: note != null && saveState !== "conflict",
  });

  const listTitle = notes.find((item) => item.id === noteId)?.title;
  const title = displayTitle(note?.title ?? listTitle);
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
      title={title}
      saveLabel={saveLabel}
      mode={mode}
      conflict={saveState === "conflict"}
      onClose={onClose}
      onToggleMode={toggleEditorMode}
      onReload={reloadFromServer}
    >
      {note ? (
        <NoteEditor
          key={`${note.id}:${mode}:${editorNonce}`}
          mode={mode}
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
