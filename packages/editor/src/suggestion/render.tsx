import type { SuggestionOptions } from "@tiptap/suggestion";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

export function createSuggestionRender<T>(
  renderMenu: (args: {
    items: T[];
    selected: number;
    onHover: (index: number) => void;
    onPick: (item: T) => void;
  }) => ReactElement,
): NonNullable<SuggestionOptions<T, T>["render"]> {
  return () => {
    let root: Root | null = null;
    let unmount: (() => void) | null = null;
    let items: T[] = [];
    let selected = 0;
    let command: ((item: T) => void) | null = null;

    function paint() {
      if (!root) return;
      root.render(
        renderMenu({
          items,
          selected,
          onHover: (index) => {
            selected = index;
            paint();
          },
          onPick: (item) => command?.(item),
        }),
      );
    }

    return {
      onStart(props) {
        items = props.items;
        selected = 0;
        command = props.command;
        const host = document.createElement("div");
        root = createRoot(host);
        paint();
        unmount = props.mount(host);
      },
      onUpdate(props) {
        items = props.items;
        selected = 0;
        command = props.command;
        paint();
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") return false;
        if (items.length === 0) return false;
        if (props.event.key === "ArrowDown") {
          props.event.preventDefault();
          selected = (selected + 1) % items.length;
          paint();
          return true;
        }
        if (props.event.key === "ArrowUp") {
          props.event.preventDefault();
          selected = (selected - 1 + items.length) % items.length;
          paint();
          return true;
        }
        if (props.event.key === "Enter") {
          const item = items[selected];
          if (!item) return false;
          props.event.preventDefault();
          command?.(item);
          return true;
        }
        return false;
      },
      onExit() {
        unmount?.();
        unmount = null;
        command = null;
        const currentRoot = root;
        root = null;
        queueMicrotask(() => currentRoot?.unmount());
      },
    };
  };
}
