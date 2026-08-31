import { closeHistory } from "@tiptap/pm/history";
import type { Plugin } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export function dispatchAsOwnUndoStep(view: EditorView, tr: Transaction): void {
  view.dispatch(closeHistory(tr));
}

export function isolateAutolinkUndo(plugin: Plugin): Plugin {
  const append = plugin.spec.appendTransaction;
  if (!append) return plugin;
  // Autolink is appendTransaction on the same keystroke; closeHistory splits
  // so Cmd+Z drops the mark instead of the typed URL.
  const spec = plugin.spec as { appendTransaction: typeof append };
  spec.appendTransaction = (transactions, oldState, newState) => {
    const tr = append(transactions, oldState, newState);
    return tr ? closeHistory(tr) : tr;
  };
  return plugin;
}
