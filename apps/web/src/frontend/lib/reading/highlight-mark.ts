import { Mark, mergeAttributes } from "@tiptap/core";

const HIGHLIGHT_BG = "#fef08a";

export const HighlightMark = Mark.create({
  name: "readingHighlight",

  addAttributes() {
    return {
      noteId: { default: "" },
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
        style: `background-color:${HIGHLIGHT_BG};border-radius:2px;padding:0 1px;cursor:pointer;`,
      }),
      0,
    ];
  },
});
