import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { MentionMenu } from "../mention/menu";
import { createSuggestionRender } from "../suggestion/render";
import type { MentionItem, MentionSource } from "../types";

const mentionPluginKey = new PluginKey("pwor-mention");

export const MentionSuggestion = Extension.create<{ source: MentionSource }>({
  name: "mentionSuggestion",

  addOptions() {
    return {
      source: {
        items: () => [],
      },
    };
  },

  addProseMirrorPlugins() {
    const source = this.options.source;
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: mentionPluginKey,
        char: "@",
        allowedPrefixes: [" ", "\n", "("],
        allow: ({ editor, state, range }) => {
          if (!editor.isEditable) return false;
          const parent = state.doc.resolve(range.from).parent;
          return parent.type.spec.code !== true;
        },
        items: async ({ query }) => [...(await source.items(query))],
        command: ({ editor, range, props }) => {
          const item = props as MentionItem;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertMention({ id: item.id, label: item.label })
            .run();
        },
        render: createSuggestionRender<MentionItem>((props) => (
          <MentionMenu
            items={props.items}
            selected={props.selected}
            onHover={props.onHover}
            onPick={props.onPick}
          />
        )),
      } satisfies SuggestionOptions<MentionItem, MentionItem>),
    ];
  },
});
