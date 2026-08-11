import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { type Extension, EditorState } from "@codemirror/state";
import {
  EditorView,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import {
  prosemarkBaseThemeSetup,
  prosemarkBasicSetup,
  prosemarkMarkdownSyntaxExtensions,
} from "@prosemark/core";

import { createHtmlPasteHandler } from "@features/notes/lib/cm-html-paste";
import {
  createWikiLinkExtensions,
  type WikiLinkEditorOptions,
} from "@features/notes/lib/cm-wiki-links";

/** Map ProseMark tokens onto Pwor theme vars; preview uses Geist Sans. */
export const pworProsemarkTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "15px",
    backgroundColor: "transparent",
    color: "var(--foreground)",
    "--pm-cursor-color": "var(--foreground)",
    "--pm-header-mark-color": "var(--muted-foreground)",
    "--pm-link-color": "var(--foreground)",
    "--pm-muted-color": "var(--muted-foreground)",
    "--pm-code-background-color": "var(--muted)",
    "--pm-code-font": "var(--font-mono)",
    "--pm-code-btn-background-color": "var(--muted)",
    "--pm-code-btn-hover-background-color": "var(--border)",
    "--pm-blockquote-vertical-line-background-color": "var(--border)",
    "--pm-syntax-comment": "var(--muted-foreground)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-sans)",
    lineHeight: "1.65",
    fontWeight: "400",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "var(--foreground)",
    fontFamily: "var(--font-sans)",
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

function insertMarkdown(view: EditorView, markdownText: string) {
  const { from, to } = view.state.selection.main;
  const needsLeadingNewline =
    from > 0 && view.state.doc.sliceString(from - 1, from) !== "\n";
  const insert = `${needsLeadingNewline ? "\n" : ""}${markdownText}\n`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
}

function uploadAndInsertFiles(
  view: EditorView,
  files: File[],
  uploadImage: (file: File) => Promise<{ url: string }>,
) {
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
}

function createImageUploadHandler(
  uploadImage: (file: File) => Promise<{ url: string }>,
) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = imageFilesFromDataTransfer(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      uploadAndInsertFiles(view, files, uploadImage);
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
      uploadAndInsertFiles(view, files, uploadImage);
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
  wikiLinks,
}: {
  doc: string;
  placeholder?: string;
  onChange: (value: string) => void;
  uploadImage?: (file: File) => Promise<{ url: string }>;
  wikiLinks?: WikiLinkEditorOptions;
}) {
  const extensions: Extension[] = [
    markdown({
      base: markdownLanguage,
      // Skip @codemirror/language-data — loading every grammar freezes large notes.
      extensions: [GFM, ...prosemarkMarkdownSyntaxExtensions],
    }),
    prosemarkBasicSetup(),
    prosemarkBaseThemeSetup(),
    pworProsemarkTheme,
    placeholder ? placeholderExt(placeholder) : [],
    createHtmlPasteHandler(),
    uploadImage ? createImageUploadHandler(uploadImage) : [],
    wikiLinks ? createWikiLinkExtensions(wikiLinks) : [],
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
  ];

  return EditorState.create({ doc, extensions });
}
