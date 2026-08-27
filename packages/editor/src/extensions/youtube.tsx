import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { youtubeIdFromInput, youtubeWatchUrl } from "../embed";
import { EmbedUrlField } from "../embed/url-field";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    youtube: {
      setYoutubeEmbed: (src?: string) => ReturnType;
    };
  }
}

function YoutubeView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";

  if (!src) {
    return (
      <NodeViewWrapper
        data-youtube=""
        className={selected ? "ProseMirror-selectednode" : undefined}
      >
        {editor.isEditable ? (
          <div className="rounded-md border border-border px-2 py-1.5">
            <EmbedUrlField
              placeholder="Paste a YouTube URL"
              onSubmit={(value) => {
                const id = youtubeIdFromInput(value);
                if (!id) return false;
                updateAttributes({ src: id });
                return true;
              }}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">YouTube</p>
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      data-youtube=""
      data-youtube-id={src}
      className={selected ? "ProseMirror-selectednode" : undefined}
    >
      <div className="aspect-video w-full overflow-hidden rounded-md border border-border/40 bg-muted">
        <iframe
          title="YouTube"
          src={`https://www.youtube-nocookie.com/embed/${src}`}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </NodeViewWrapper>
  );
}

export const Youtube = Node.create({
  name: "youtube",
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
        tag: "div[data-youtube]",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const id =
            node.getAttribute("data-youtube-id") ||
            youtubeIdFromInput(node.getAttribute("src") ?? "");
          return id ? { src: id } : false;
        },
      },
      {
        tag: "iframe",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const id = youtubeIdFromInput(node.getAttribute("src") ?? "");
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
        "data-youtube": "",
        "data-youtube-id": src,
      }),
    ];
  },

  renderText({ node }) {
    const src = node.attrs.src;
    return typeof src === "string" && src.length > 0 ? youtubeWatchUrl(src) : "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView);
  },

  addCommands() {
    return {
      setYoutubeEmbed:
        (src = "") =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { src } }).run(),
    };
  },
});
