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
  const { body, ...rest } = serializeNote(row);
  return {
    ...rest,
    hasBody: noteHasBody(body),
    noted: noteIsNoted(body),
    bodyPreview: noteBodyPreview(body),
  };
}
