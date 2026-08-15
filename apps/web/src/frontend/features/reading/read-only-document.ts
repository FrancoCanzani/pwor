import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const PAINT_HIGHLIGHTS_META = "paintHighlights";

export const ReadOnlyDocument = Extension.create({
  name: "readOnlyDocument",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("readOnlyDocument"),
        filterTransaction(tr) {
          if (!tr.docChanged) return true;
          return tr.getMeta(PAINT_HIGHLIGHTS_META) === true;
        },
      }),
    ];
  },
});
