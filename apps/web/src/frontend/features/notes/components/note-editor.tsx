import { DocumentEditor, type DocumentJSON } from "@pwor/editor";

import { cn } from "@/lib/utils";
import {
  displayTitle,
  filterNotesByQuery,
  type NoteTitleRef,
} from "@features/notes/lib/wiki-links";

export function NoteEditor({
  initialDocument,
  placeholder = "Type '/' for commands",
  onChange,
  uploadImage,
  mentions,
  className,
  autoFocus = true,
}: {
  initialDocument: DocumentJSON;
  placeholder?: string;
  onChange: (doc: DocumentJSON) => void;
  uploadImage?: (file: File) => Promise<{ src: string }>;
  mentions?: {
    currentNoteId: string;
    getNotes: () => readonly NoteTitleRef[];
    onOpenNote: (noteId: string) => void;
  };
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <DocumentEditor
      initialDocument={initialDocument}
      placeholder={placeholder}
      onChange={onChange}
      uploadImage={uploadImage}
      autoFocus={autoFocus}
      className={cn("min-h-[12rem]", className)}
      mentions={
        mentions
          ? {
              items: (query) =>
                filterNotesByQuery(
                  mentions.getNotes(),
                  query,
                  mentions.currentNoteId,
                ).map((note) => ({
                  id: note.id,
                  label: displayTitle(note),
                })),
              onOpen: (item) => mentions.onOpenNote(item.id),
            }
          : undefined
      }
    />
  );
}
