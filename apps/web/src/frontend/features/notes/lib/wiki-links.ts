export type NoteTitleRef = {
  id: string;
  title: string | null;
};

function titleKey(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase();
}

export function filterNotesByQuery(
  notes: readonly NoteTitleRef[],
  query: string,
  currentNoteId?: string,
  limit = 8,
): NoteTitleRef[] {
  const q = titleKey(query);
  const pool = notes.filter((note) => note.id !== currentNoteId);
  if (!q) return pool.slice(0, limit);

  const scored = pool
    .map((note) => {
      const title = titleKey(note.title) || "untitled";
      let score: number;
      if (title === q) score = 3;
      else if (title.startsWith(q)) score = 2;
      else if (title.includes(q)) score = 1;
      else return null;
      return { note, score, title };
    })
    .filter(
      (row): row is { note: NoteTitleRef; score: number; title: string } =>
        row != null,
    )
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored.slice(0, limit).map((row) => row.note);
}

export function displayTitle(note: NoteTitleRef): string {
  const trimmed = note.title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled";
}
