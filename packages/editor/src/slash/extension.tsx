import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { createSuggestionRender } from "../lib/suggestion-render";
import { filterSlashItems, slashItems, type SlashItem } from "./items";
import { SlashMenu } from "./menu";

const slashPluginKey = new PluginKey("pwor-slash");

export const SlashCommand = Extension.create<{ canUpload: boolean }>({
  name: "slashCommand",

  addOptions() {
    return { canUpload: false };
  },

  addProseMirrorPlugins() {
    const items = slashItems(this.options.canUpload);
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: "/",
        allowedPrefixes: [" ", "\n"],
        startOfLine: false,
        allow: ({ editor, state, range }) => {
          if (!editor.isEditable) return false;
          const parent = state.doc.resolve(range.from).parent;
          return parent.type.name === "paragraph" || parent.type.name === "heading";
        },
        items: ({ query }) => filterSlashItems(items, query),
        command: ({ editor, range, props }) => {
          (props as SlashItem).run(editor, range);
        },
        render: createSuggestionRender<SlashItem>((props) => (
          <SlashMenu
            items={props.items}
            selected={props.selected}
            onHover={props.onHover}
            onPick={props.onPick}
          />
        )),
      } satisfies SuggestionOptions<SlashItem, SlashItem>),
    ];
  },
});
