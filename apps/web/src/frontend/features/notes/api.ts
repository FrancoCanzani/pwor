import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type NoteListItem = {
  id: string;
  title: string | null;
  workspaceId: string | null;
  updatedAt: string | Date;
  createdAt: string | Date;
};

export type Note = NoteListItem & {
  body: string;
  userId: string;
  workspaceId: string | null;
};

async function fetchNotes(workspaceId?: string): Promise<NoteListItem[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
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
    queryKey: ["notes", "list", workspaceId] as const,
    queryFn: () => fetchNotes(workspaceId),
  });
}

export function noteQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["notes", "detail", id] as const,
    queryFn: () => fetchNote(id),
  });
}

export async function createNote(
  body = "",
  title?: string | null,
  workspaceId?: string | null,
): Promise<Note> {
  return parseJson<Note>(
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, title, workspaceId }),
    }),
  );
}

export async function updateNote(
  id: string,
  patch: { body?: string; title?: string | null; workspaceId?: string | null },
): Promise<Note> {
  return parseJson<Note>(
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function updateNoteProject(
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
