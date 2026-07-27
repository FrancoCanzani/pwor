import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const odiseumHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "700", color: "var(--foreground)" },
  { tag: tags.heading1, fontSize: "1.35em", lineHeight: "1.3" },
  { tag: tags.heading2, fontSize: "1.15em", lineHeight: "1.35" },
  { tag: tags.heading3, fontSize: "1.05em" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--muted-foreground)" },
  { tag: tags.url, color: "var(--muted-foreground)" },
  { tag: tags.monospace, color: "var(--muted-foreground)" },
  { tag: tags.processingInstruction, color: "var(--muted-foreground)" },
  { tag: tags.meta, color: "var(--muted-foreground)" },
  { tag: tags.comment, color: "var(--muted-foreground)" },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--foreground)" },
]);

export const odiseumEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.65",
    fontWeight: "400",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "var(--foreground)",
    fontFamily: "var(--font-mono)",
  },
  ".cm-line": {
    padding: "0",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "var(--muted) !important",
    },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
  },
});

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function imageFilesFromDataTransfer(
  data: DataTransfer | null | undefined,
): File[] {
  if (!data) return [];
  const files: File[] = [];
  if (data.files?.length) {
    for (const file of Array.from(data.files)) {
      if (isImageFile(file)) files.push(file);
    }
    return files;
  }
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) files.push(file);
  }
  return files;
}

function altFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return base.length > 0 ? base : "image";
}

function insertMarkdown(view: EditorView, markdown: string) {
  const { from, to } = view.state.selection.main;
  const needsLeadingNewline =
    from > 0 && view.state.doc.sliceString(from - 1, from) !== "\n";
  const insert = `${needsLeadingNewline ? "\n" : ""}${markdown}\n`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
}

function createImageUploadHandler(
  uploadImage: (file: File) => Promise<{ url: string }>,
) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = imageFilesFromDataTransfer(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      void (async () => {
        for (const file of files) {
          try {
            const { url } = await uploadImage(file);
            insertMarkdown(view, `![${altFromFilename(file.name)}](${url})`);
          } catch {
            insertMarkdown(view, `<!-- failed to upload ${file.name} -->`);
          }
        }
      })();
      return true;
    },
    drop(event, view) {
      const files = imageFilesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) return false;
      event.preventDefault();
      event.stopPropagation();
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos != null) {
        view.dispatch({ selection: { anchor: pos } });
      }
      void (async () => {
        for (const file of files) {
          try {
            const { url } = await uploadImage(file);
            insertMarkdown(view, `![${altFromFilename(file.name)}](${url})`);
          } catch {
            insertMarkdown(view, `<!-- failed to upload ${file.name} -->`);
          }
        }
      })();
      return true;
    },
    dragover(event) {
      if (!event.dataTransfer?.types.includes("Files")) return false;
      event.preventDefault();
      event.stopPropagation();
      return true;
    },
  });
}

export function createNoteEditorState({
  doc,
  placeholder,
  onChange,
  uploadImage,
}: {
  doc: string;
  placeholder?: string;
  onChange: (value: string) => void;
  uploadImage?: (file: File) => Promise<{ url: string }>;
}) {
  return EditorState.create({
    doc,
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      // No codeLanguages — @codemirror/language-data loads every grammar and
      // will freeze the tab on larger notes / fenced blocks.
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(odiseumHighlight),
      odiseumEditorTheme,
      EditorView.lineWrapping,
      placeholder ? placeholderExt(placeholder) : [],
      uploadImage ? createImageUploadHandler(uploadImage) : [],
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });
}
