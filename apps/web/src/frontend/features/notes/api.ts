import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import type { HighlightAnchor } from "@lib/reading/highlight-anchor";
import { toEpochMs } from "@shared/time";

export type HighlightTarget = { itemId: string };

export type NoteListItem = {
  id: string;
  title: string | null;
  spaceId: string | null;
  updatedAt: string | Date;
  createdAt: string | Date;
  itemId: string | null;
  anchorFrom: number | null;
  anchorTo: number | null;
  anchorQuote: string | null;
  anchorPrefix: string | null;
  anchorSuffix: string | null;
  hasBody?: boolean;
  noted?: boolean;
  bodyPreview?: string | null;
  body?: string;
  pinned?: boolean;
};

export type Note = NoteListItem & {
  body: string;
  userId: string;
};

export class NoteConflictError extends Error {
  readonly note: Note;

  constructor(note: Note) {
    super("Note was edited elsewhere");
    this.name = "NoteConflictError";
    this.note = note;
  }
}

export { toEpochMs };

export function noteAnchor(note: NoteListItem): HighlightAnchor | null {
  if (
    note.anchorFrom == null ||
    note.anchorTo == null ||
    !note.anchorQuote
  ) {
    return null;
  }
  return {
    from: note.anchorFrom,
    to: note.anchorTo,
    quote: note.anchorQuote,
    prefix: note.anchorPrefix ?? "",
    suffix: note.anchorSuffix ?? "",
  };
}

export function noteHasAnchor(
  note: NoteListItem,
): note is NoteListItem & {
  anchorFrom: number;
  anchorTo: number;
  anchorQuote: string;
} {
  return noteAnchor(note) != null;
}

export function isStandaloneNote(note: NoteListItem): boolean {
  return note.itemId == null;
}

export function passageIsNoted(note: NoteListItem): boolean {
  return Boolean(note.noted || note.hasBody);
}

async function fetchNotes(filter?: {
  spaceId?: string;
  standalone?: boolean;
  target?: HighlightTarget;
}): Promise<NoteListItem[]> {
  const params = new URLSearchParams();
  if (filter?.spaceId) params.set("spaceId", filter.spaceId);
  if (filter?.standalone) params.set("standalone", "1");
  if (filter?.target) params.set("itemId", filter.target.itemId);
  const query = params.toString();
  const data = await parseJson<{ items: NoteListItem[] }>(
    await fetch(`/api/notes${query ? `?${query}` : ""}`),
  );
  return data.items;
}

async function fetchNote(id: string): Promise<Note> {
  return parseJson<Note>(await fetch(`/api/notes/${id}`));
}

export const notesDeleteKey = ["notes", "delete"] as const;
export const notesMoveKey = ["notes", "move"] as const;
export const notesPinKey = ["notes", "pin"] as const;

export function notesQueryOptions(spaceId?: string) {
  return queryOptions({
    queryKey: ["notes", "list", spaceId ?? null, "standalone"] as const,
    queryFn: () => fetchNotes({ spaceId, standalone: true }),
  });
}

export function targetNotesQueryOptions(target: HighlightTarget) {
  return queryOptions({
    queryKey: ["notes", "list", "itemId", target.itemId] as const,
    queryFn: () => fetchNotes({ target }),
  });
}

export function noteQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["notes", "detail", id] as const,
    queryFn: () => fetchNote(id),
  });
}

export async function createNote(params: {
  body?: string;
  title?: string | null;
  spaceId?: string | null;
  target?: HighlightTarget;
  anchor?: HighlightAnchor;
}): Promise<Note> {
  return parseJson<Note>(
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: params.body ?? "",
        title: params.title,
        spaceId: params.spaceId,
        ...(params.target ?? {}),
        ...(params.anchor ? { anchor: params.anchor } : {}),
      }),
    }),
  );
}

export async function updateNote(
  id: string,
  patch: {
    body?: string;
    title?: string | null;
    spaceId?: string | null;
    pinned?: boolean;
    expectedUpdatedAt?: string | Date | number;
  },
): Promise<Note> {
  const res = await fetch(`/api/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...patch,
      ...(patch.expectedUpdatedAt !== undefined
        ? { expectedUpdatedAt: toEpochMs(patch.expectedUpdatedAt) }
        : {}),
    }),
  });

  if (res.status === 409) {
    const data = (await res.json()) as { error?: string; note?: Note };
    if (data.note) throw new NoteConflictError(data.note);
    throw new Error("Note conflict");
  }

  return parseJson<Note>(res);
}

export async function updateNotes(
  ids: string[],
  patch: { spaceId?: string | null; pinned?: boolean },
): Promise<Note[]> {
  if (ids.length === 0) return [];
  const data = await parseJson<{ items: Note[] }>(
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, ...patch }),
    }),
  );
  return data.items;
}

export async function updateNoteSpace(
  id: string,
  spaceId: string | null,
): Promise<Note> {
  const [updated] = await updateNotes([id], { spaceId });
  if (!updated) throw new Error("Failed to move note");
  return updated;
}

export async function deleteNotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await parseJson<{ ok: boolean }>(
    await fetch("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  );
}

export async function deleteNote(id: string): Promise<void> {
  await deleteNotes([id]);
}

export async function uploadNoteImage(
  noteId: string,
  file: File,
): Promise<{ id: string; url: string; mimeType: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return parseJson(
    await fetch(`/api/notes/${noteId}/images`, {
      method: "POST",
      body: formData,
    }),
  );
}
