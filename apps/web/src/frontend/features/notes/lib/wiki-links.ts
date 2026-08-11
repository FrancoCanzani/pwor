export const WIKI_LINK_RE =
  /\[\[([^\]|#\n]+?)(?:#([^\]|\n]*?))?(?:\|([^\]\n]*?))?\]\]/g;

export type WikiLinkMatch = {
  from: number;
  to: number;
  target: string;
  heading: string | null;
  alias: string | null;
};

export function findWikiLinks(text: string): WikiLinkMatch[] {
  const matches: WikiLinkMatch[] = [];
  const re = new RegExp(WIKI_LINK_RE.source, "g");
  for (const match of text.matchAll(re)) {
    const full = match[0];
    const index = match.index;
    if (index == null || full == null) continue;
    const target = match[1]?.trim() ?? "";
    if (!target) continue;
    matches.push({
      from: index,
      to: index + full.length,
      target,
      heading: match[2]?.trim() || null,
      alias: match[3]?.trim() || null,
    });
  }
  return matches;
}

/** Lowercase trim key for wiki-link target matching — not display title. */
export function wikiTitleKey(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase();
}

export type NoteTitleRef = {
  id: string;
  title: string | null;
};

export function notesFingerprint(
  notes: readonly NoteTitleRef[] | undefined,
): string {
  if (!notes) return "";
  return notes.map((note) => `${note.id}:${note.title ?? ""}`).join("\0");
}

export function resolveWikiLinkTarget(
  target: string,
  notes: readonly NoteTitleRef[],
  currentNoteId?: string,
): string | null {
  const needle = wikiTitleKey(target);
  if (!needle) return null;

  const exact = notes.find(
    (note) =>
      note.id !== currentNoteId && wikiTitleKey(note.title) === needle,
  );
  if (exact) return exact.id;

  if (needle === "untitled") {
    const untitled = notes.find(
      (note) =>
        note.id !== currentNoteId && wikiTitleKey(note.title) === "",
    );
    if (untitled) return untitled.id;
  }

  return null;
}

export function filterNotesByQuery(
  notes: readonly NoteTitleRef[],
  query: string,
  currentNoteId?: string,
  limit = 8,
): NoteTitleRef[] {
  const q = wikiTitleKey(query);
  const pool = notes.filter((note) => note.id !== currentNoteId);
  if (!q) return pool.slice(0, limit);

  const scored = pool
    .map((note) => {
      const title = wikiTitleKey(note.title) || "untitled";
      let score = 0;
      if (title === q) score = 3;
      else if (title.startsWith(q)) score = 2;
      else if (title.includes(q)) score = 1;
      else return null;
      return { note, score, title };
    })
    .filter((row): row is { note: NoteTitleRef; score: number; title: string } =>
      row != null,
    )
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored.slice(0, limit).map((row) => row.note);
}

export function displayTitle(note: NoteTitleRef): string {
  const trimmed = note.title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled";
}
