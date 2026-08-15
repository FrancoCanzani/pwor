import { Node, mergeAttributes } from "@tiptap/core";

function videoAttrs(node: HTMLElement) {
  const src =
    node.getAttribute("src") ||
    node.querySelector("source")?.getAttribute("src");
  if (!src) return false;
  return {
    src,
    poster: node.getAttribute("poster"),
    width: node.getAttribute("width"),
    height: node.getAttribute("height"),
  };
}

export const ReadingVideo = Node.create({
  name: "readingVideo",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
        getAttrs: (node) =>
          node instanceof HTMLElement ? videoAttrs(node) : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "",
        playsinline: "",
        preload: "metadata",
        class: "reading-video",
      }),
    ];
  },
});
