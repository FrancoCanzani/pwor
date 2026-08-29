import {
  noteBodyPreview,
  noteHasBody,
  noteIsNoted,
} from "@shared/note-frontmatter";

export function serializeNote<T extends { pinnedAt: Date | null }>(row: T) {
  const { pinnedAt, ...rest } = row;
  return {
    ...rest,
    pinned: pinnedAt != null,
  };
}

export function serializeNoteListItem<
  T extends {
    body: string;
    pinnedAt: Date | null;
  },
>(row: T) {
  const serialized = serializeNote(row);
  return {
    ...serialized,
    hasBody: noteHasBody(serialized.body),
    noted: noteIsNoted(serialized.body),
    bodyPreview: noteBodyPreview(serialized.body),
  };
}
