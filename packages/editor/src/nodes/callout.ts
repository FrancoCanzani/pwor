import { Node, mergeAttributes } from "@tiptap/core";

export const CALLOUT_TONES = ["note", "tip", "warning"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

function calloutTone(value: unknown): CalloutTone {
  if (value === "tip" || value === "warning" || value === "note") return value;
  return "note";
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (tone?: CalloutTone) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      tone: {
        default: "note" satisfies CalloutTone,
        parseHTML: (element) => calloutTone(element.getAttribute("data-tone")),
        renderHTML: (attributes) => ({ "data-tone": calloutTone(attributes.tone) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "aside[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, { "data-callout": "" }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (tone = "note") =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { tone },
              content: [{ type: "paragraph" }],
            })
            .run(),
    };
  },
});
