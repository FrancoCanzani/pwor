import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { tweetIdFromInput, youtubeIdFromInput } from "../embed";

const key = new PluginKey("pwor-embed-paste");

export const EmbedPaste = Extension.create({
  name: "embedPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key,
        props: {
          handlePaste(_view, event) {
            if (!editor.isEditable) return false;
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text || /\s/.test(text)) return false;
            const $from = editor.state.selection.$from;
            if ($from.parent.type.spec.code) return false;
            const youtube = youtubeIdFromInput(text);
            if (youtube) {
              editor
                .chain()
                .focus()
                .insertContent({ type: "youtube", attrs: { src: youtube } })
                .run();
              return true;
            }
            const tweet = tweetIdFromInput(text);
            if (tweet) {
              editor
                .chain()
                .focus()
                .insertContent({ type: "tweet", attrs: { src: tweet } })
                .run();
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
