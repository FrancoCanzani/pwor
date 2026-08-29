import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useRef } from "react";
import { tweetIdFromInput, tweetStatusUrl } from ".";
import { EmbedUrlField } from "./url-field";

const WIDGET_SRC = "https://platform.twitter.com/widgets.js";

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        createTweet: (
          id: string,
          el: HTMLElement,
          options?: Record<string, unknown>,
        ) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

let widgets: Promise<void> | null = null;

function loadWidgets(): Promise<void> {
  if (window.twttr?.widgets) return Promise.resolve();
  if (widgets) return widgets;
  widgets = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGET_SRC}"]`);
    if (window.twttr?.widgets) {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(), { once: true });
    document.head.append(script);
  });
  return widgets;
}

function TweetFrame({ id }: { id: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    let cancelled = false;
    void loadWidgets()
      .then(() => {
        if (cancelled || !hostRef.current) return;
        return window.twttr?.widgets?.createTweet(id, hostRef.current, {
          align: "center",
          conversation: "none",
          dnt: true,
          theme: "light",
        });
      })
      .catch(() => {
        if (cancelled || !hostRef.current) return;
        const link = document.createElement("a");
        link.href = tweetStatusUrl(id);
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = tweetStatusUrl(id);
        hostRef.current.replaceChildren(link);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return <div ref={hostRef} className="min-h-24" />;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tweet: {
      setTweetEmbed: (src?: string) => ReturnType;
    };
  }
}

function TweetView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";

  if (!src) {
    return (
      <NodeViewWrapper
        data-tweet=""
        className={selected ? "ProseMirror-selectednode" : undefined}
      >
        {editor.isEditable ? (
          <div className="rounded-md border border-border px-2 py-1.5">
            <EmbedUrlField
              placeholder="Paste an X URL"
              onSubmit={(value) => {
                const id = tweetIdFromInput(value);
                if (!id) return false;
                updateAttributes({ src: id });
                return true;
              }}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Post</p>
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      data-tweet=""
      data-tweet-id={src}
      className={selected ? "ProseMirror-selectednode" : undefined}
    >
      <TweetFrame id={src} />
    </NodeViewWrapper>
  );
}

export const Tweet = Node.create({
  name: "tweet",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      src: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-tweet]",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const id =
            node.getAttribute("data-tweet-id") ||
            tweetIdFromInput(node.getAttribute("src") ?? "");
          return id ? { src: id } : false;
        },
      },
      {
        tag: "blockquote.twitter-tweet",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const href =
            node.querySelector("a[href*='/status/']")?.getAttribute("href") ??
            "";
          const id = tweetIdFromInput(href);
          return id ? { src: id } : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-tweet": "",
        "data-tweet-id": src,
      }),
    ];
  },

  renderText({ node }) {
    const src = node.attrs.src;
    return typeof src === "string" && src.length > 0 ? tweetStatusUrl(src) : "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(TweetView);
  },

  addCommands() {
    return {
      setTweetEmbed:
        (src = "") =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { src } }).run(),
    };
  },
});
