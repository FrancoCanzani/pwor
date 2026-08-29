import { useMemo } from "react";
import { DocumentEditor } from "@pwor/editor";

import { cn } from "@/lib/utils";
import { bodyToDocument } from "@features/notes/lib/legacy-document";

export function NotePreview({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const document = useMemo(() => bodyToDocument(body), [body]);

  return (
    <DocumentEditor
      initialDocument={document}
      onChange={() => {}}
      editable={false}
      autoFocus={false}
      className={cn(
        "pointer-events-none min-h-0 select-none [&_.tiptap]:min-h-0 [&_.tiptap]:text-[11px] [&_.tiptap]:leading-snug [&_img]:max-h-24",
        className,
      )}
    />
  );
}
