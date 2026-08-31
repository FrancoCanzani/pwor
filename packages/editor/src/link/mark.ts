import Link from "@tiptap/extension-link";
import { isolateAutolinkUndo } from "../lib/undo-isolation";
import { linkClickPlugin } from "./click";

export const EditorLink = Link.extend({
  inclusive: false,

  addProseMirrorPlugins() {
    const plugins = this.parent?.() ?? [];
    return [...plugins.map(isolateAutolinkUndo), linkClickPlugin()];
  },
});
