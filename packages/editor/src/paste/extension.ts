import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import MarkdownIt from "markdown-it";
import { tweetIdFromInput, youtubeIdFromInput } from "../embed";
import { normalizeHref } from "../link/href";
import {
  clipboardText,
  isEmptyParagraph,
  isInCode,
  isInList,
  isMarkdown,
  isUrl,
  parseIframeSrc,
  vscodeLanguage,
} from "./detect";

const key = new PluginKey("pwor-paste");
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false });

function insertEmbed(editor: Editor, type: "youtube" | "tweet", src: string) {
  editor.chain().focus().insertContent({ type, attrs: { src } }).run();
}

export const PasteHandler = Extension.create({
  name: "pasteHandler",

  addProseMirrorPlugins() {
    const editor = this.editor;
    let shiftKey = false;

    return [
      new Plugin({
        key,
        props: {
          handleDOMEvents: {
            keydown: (_, event) => {
              if (event.key === "Shift") shiftKey = true;
              return false;
            },
            keyup: (_, event) => {
              if (event.key === "Shift") shiftKey = false;
              return false;
            },
          },
          handlePaste: (view, event) => {
            if (!editor.isEditable) return false;
            if (!event.clipboardData) return false;

            const iframeSrc = parseIframeSrc(event.clipboardData.getData("text/plain"));
            const text = iframeSrc && !isInCode(view.state) ? iframeSrc : clipboardText(event);
            const { state, dispatch } = view;

            if (shiftKey) {
              if (text.length === 0) return false;
              dispatch(state.tr.insertText(text));
              return true;
            }

            if (isInCode(state)) {
              if (text.length === 0) return false;
              dispatch(state.tr.insertText(text));
              return true;
            }

            if (isUrl(text)) {
              if (event.clipboardData.files.length > 0) return false;
              const href = normalizeHref(text) ?? text;

              if (!state.selection.empty) {
                editor.chain().focus().setLink({ href }).run();
                return true;
              }

              if (!isInList(state) && isEmptyParagraph(state)) {
                const youtube = youtubeIdFromInput(text);
                if (youtube) {
                  insertEmbed(editor, "youtube", youtube);
                  return true;
                }
                const tweet = tweetIdFromInput(text);
                if (tweet) {
                  insertEmbed(editor, "tweet", tweet);
                  return true;
                }
              }

              const link = state.schema.marks.link;
              if (!link) return false;

              dispatch(
                state.tr
                  .insertText(text, state.selection.from, state.selection.to)
                  .addMark(
                    state.selection.from,
                    state.selection.to + text.length,
                    link.create({ href }),
                  ),
              );
              return true;
            }

            const language = vscodeLanguage(event);
            if (language && language !== "markdown") {
              if (text.includes("\n") && state.schema.nodes.codeBlock) {
                const node = state.schema.nodes.codeBlock.create(
                  { language },
                  text.length > 0 ? state.schema.text(text) : undefined,
                );
                const tr = state.tr.replaceSelectionWith(node);
                const paragraph = state.schema.nodes.paragraph;
                if (paragraph && tr.selection.from === tr.doc.content.size - 1) {
                  const para = paragraph.create();
                  tr.insert(tr.selection.from, para).setSelection(
                    TextSelection.near(tr.doc.resolve(tr.selection.from + para.nodeSize + 1)),
                  );
                }
                dispatch(tr.scrollIntoView());
                return true;
              }
              if (state.schema.marks.code) {
                dispatch(
                  state.tr
                    .insertText(text, state.selection.from, state.selection.to)
                    .addMark(
                      state.selection.from,
                      state.selection.to + text.length,
                      state.schema.marks.code.create(),
                    ),
                );
                return true;
              }
            }

            const html = event.clipboardData.getData("text/html");
            if (html.includes("data-pm-slice")) return false;

            if (isMarkdown(text) || language === "markdown") {
              const rendered = markdown.render(text);
              if (rendered.trim().length === 0) return false;
              editor.chain().focus().insertContent(rendered).run();
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
