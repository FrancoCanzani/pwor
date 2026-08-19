import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";
import type { HighlightAnchor } from "@lib/reading/highlight-anchor";
import { toEpochMs } from "@shared/time";

export type HighlightTarget = { itemId: string } | { feedItemId: string };

export type NoteListItem = {
  id: string;
  title: string | null;
  workspaceId: string | null;
  updatedAt: string | Date;
  createdAt: string | Date;
  itemId: string | null;
  feedItemId: string | null;
  anchorFrom: number | null;
  anchorTo: number | null;
  anchorQuote: string | null;
  anchorPrefix: string | null;
  anchorSuffix: string | null;
  hasBody?: boolean;
  noted?: boolean;
  bodyPreview?: string | null;
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
  return note.itemId == null && note.feedItemId == null;
}

export function passageIsNoted(note: NoteListItem): boolean {
  return Boolean(note.noted || note.hasBody);
}

async function fetchNotes(filter?: {
  workspaceId?: string;
  target?: HighlightTarget;
}): Promise<NoteListItem[]> {
  const params = new URLSearchParams();
  if (filter?.workspaceId) params.set("workspaceId", filter.workspaceId);
  if (filter?.target) {
    if ("itemId" in filter.target) params.set("itemId", filter.target.itemId);
    else params.set("feedItemId", filter.target.feedItemId);
  }
  const query = params.toString();
  const data = await parseJson<{ items: NoteListItem[] }>(
    await fetch(`/api/notes${query ? `?${query}` : ""}`),
  );
  return data.items;
}

async function fetchNote(id: string): Promise<Note> {
  return parseJson<Note>(await fetch(`/api/notes/${id}`));
}

export function notesQueryOptions(workspaceId?: string) {
  return queryOptions({
    queryKey: ["notes", "list", workspaceId ?? null] as const,
    queryFn: () => fetchNotes({ workspaceId }),
  });
}

export function targetNotesQueryOptions(target: HighlightTarget) {
  const key =
    "itemId" in target
      ? (["itemId", target.itemId] as const)
      : (["feedItemId", target.feedItemId] as const);
  return queryOptions({
    queryKey: ["notes", "list", key[0], key[1]] as const,
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
  workspaceId?: string | null;
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
        workspaceId: params.workspaceId,
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
    workspaceId?: string | null;
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

export async function updateNoteWorkspace(
  id: string,
  workspaceId: string | null,
): Promise<Note> {
  return updateNote(id, { workspaceId });
}

export async function deleteNote(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/notes/${id}`, { method: "DELETE" }),
  );
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
