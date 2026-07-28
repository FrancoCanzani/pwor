import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type NoteListItem = {
  id: string;
  title: string | null;
  updatedAt: string | Date;
  createdAt: string | Date;
};

export type Note = NoteListItem & {
  body: string;
  userId: string;
};

async function fetchNotes(): Promise<NoteListItem[]> {
  const data = await parseJson<{ items: NoteListItem[] }>(
    await fetch("/api/notes"),
  );
  return data.items;
}

async function fetchNote(id: string): Promise<Note> {
  return parseJson<Note>(await fetch(`/api/notes/${id}`));
}

export const notesQueryOptions = queryOptions({
  queryKey: ["notes", "list"] as const,
  queryFn: fetchNotes,
});

export function noteQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["notes", "detail", id] as const,
    queryFn: () => fetchNote(id),
  });
}

export async function createNote(
  body = "",
  title?: string | null,
): Promise<Note> {
  return parseJson<Note>(
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, title }),
    }),
  );
}

export async function updateNote(
  id: string,
  patch: { body?: string; title?: string | null },
): Promise<Note> {
  return parseJson<Note>(
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
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
