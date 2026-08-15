import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { htmlToMarkdown } from "@lib/html-to-markdown";

function clipboardHasImageFile(data: DataTransfer | null): boolean {
  if (!data) return false;
  if (data.files?.length) {
    return Array.from(data.files).some((file) => file.type.startsWith("image/"));
  }
  return Array.from(data.items).some(
    (item) => item.kind === "file" && item.type.startsWith("image/"),
  );
}

export function createHtmlPasteHandler(): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const clipboard = event.clipboardData;
      if (!clipboard || clipboardHasImageFile(clipboard)) return false;

      const html = clipboard.getData("text/html")?.trim();
      if (!html) return false;

      if (!/[<](p|div|li|h[1-6]|table|ul|ol|pre|blockquote)\b/i.test(html)) {
        return false;
      }

      const markdown = htmlToMarkdown(html);
      if (!markdown) return false;

      event.preventDefault();
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: markdown },
        selection: { anchor: from + markdown.length },
        scrollIntoView: true,
      });
      return true;
    },
  });
}
