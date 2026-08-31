import { Plugin, PluginKey } from "@tiptap/pm/state";

const key = new PluginKey("pwor-link-click");

function hrefFromEvent(event: MouseEvent): string | null {
  if (event.defaultPrevented) return null;
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  return anchor.getAttribute("href");
}

export function openHref(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

export function linkClickPlugin() {
  return new Plugin({
    key,
    props: {
      handleClick(view, _pos, event) {
        if (!(event instanceof MouseEvent) || event.button !== 0) return false;
        if (!view.state.selection.empty) return false;
        const href = hrefFromEvent(event);
        if (!href) return false;
        openHref(href);
        event.preventDefault();
        event.stopPropagation();
        return true;
      },
      handleDOMEvents: {
        auxclick(_view, event) {
          if (event.button !== 1) return false;
          const href = hrefFromEvent(event);
          if (!href) return false;
          openHref(href);
          event.preventDefault();
          event.stopPropagation();
          return true;
        },
      },
    },
  });
}
