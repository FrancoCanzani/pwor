import { Mark, mergeAttributes } from "@tiptap/core";

import { HIGHLIGHT_COLOR_BG } from "./highlight-colors";

export interface HighlightMarkAttrs {
  noteId: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    readingHighlight: {
      setReadingHighlight: (attrs: HighlightMarkAttrs) => ReturnType;
      unsetReadingHighlight: () => ReturnType;
    };
  }
}

export const HighlightMark = Mark.create({
  name: "readingHighlight",

  addAttributes() {
    return {
      noteId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-highlight-note-id]" }];
  },

  renderHTML({ mark }) {
    return [
      "mark",
      mergeAttributes({
        "data-highlight-note-id": mark.attrs.noteId,
        style: `background-color:${HIGHLIGHT_COLOR_BG};border-radius:2px;padding:0 1px;cursor:pointer;`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setReadingHighlight:
        (attrs: HighlightMarkAttrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetReadingHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
