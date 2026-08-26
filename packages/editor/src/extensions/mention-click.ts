import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { MentionSource } from "../types";

const key = new PluginKey("mention-click");

export function mentionClickPlugin(source: MentionSource | undefined) {
  return new Plugin({
    key,
    props: {
      handleClick(_view, _pos, event) {
        if (!source?.onOpen) return false;
        const target = event.target;
        if (!(target instanceof Element)) return false;
        const chip = target.closest("[data-mention]");
        if (!chip) return false;
        const id = chip.getAttribute("data-mention-id");
        const label = chip.getAttribute("data-mention-label") ?? "";
        if (!id) return false;
        source.onOpen({ id, label });
        return true;
      },
    },
  });
}
