import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mention: {
      insertMention: (attrs: { id: string; label: string }) => ReturnType;
    };
  }
}

export const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-mention]",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          return {
            id: node.getAttribute("data-mention-id") ?? "",
            label: node.getAttribute("data-mention-label") ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
    const label = typeof node.attrs.label === "string" ? node.attrs.label : "";
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-mention": "",
      "data-mention-id": id,
      "data-mention-label": label,
    });
    delete attrs.id;
    delete attrs.label;
    return ["span", attrs, `@${label}`];
  },

  renderText({ node }) {
    const label = node.attrs.label;
    return typeof label === "string" && label.length > 0 ? `@${label}` : "";
  },

  addCommands() {
    return {
      insertMention:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
