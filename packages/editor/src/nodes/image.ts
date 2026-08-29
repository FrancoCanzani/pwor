import Image from "@tiptap/extension-image";

export const EditorImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: { default: null },
      alt: { default: "" },
    };
  },
});
