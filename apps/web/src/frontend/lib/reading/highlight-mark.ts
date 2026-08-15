import { Mark } from "@tiptap/core";

export const NOTED_MARK_SELECTOR = "mark[data-noted][data-highlight-note-id]";

export const HighlightMark = Mark.create({
  name: "readingHighlight",

  addAttributes() {
    return {
      noteId: { default: "" },
      noted: {
        default: false,
        parseHTML: (el) => el.hasAttribute("data-noted"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-highlight-note-id]" }];
  },

  renderHTML({ mark }) {
    const noted = Boolean(mark.attrs.noted);
    return [
      "mark",
      {
        "data-highlight-note-id": mark.attrs.noteId,
        ...(noted ? { "data-noted": "" } : {}),
        class: noted ? "reading-noted" : "reading-highlight",
      },
      0,
    ];
  },
});
