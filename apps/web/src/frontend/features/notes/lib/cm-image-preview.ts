import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

class ImagePreviewWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
  ) {
    super();
  }

  override eq(other: ImagePreviewWidget) {
    return this.url === other.url && this.alt === other.alt;
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-note-image-preview";
    wrap.contentEditable = "false";

    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.alt || "";
    img.loading = "lazy";
    img.draggable = false;
    img.onerror = () => {
      wrap.classList.add("cm-note-image-preview-broken");
      img.remove();
      const fallback = document.createElement("span");
      fallback.textContent = "Image unavailable";
      wrap.appendChild(fallback);
    };
    wrap.appendChild(img);
    return wrap;
  }

  override ignoreEvent() {
    return true;
  }
}

function isPreviewableUrl(url: string): boolean {
  return (
    url.startsWith("/api/notes/images/") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("data:image/")
  );
}

function buildImagePreviewDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const re = new RegExp(IMAGE_MD_RE.source, "g");
    for (const match of text.matchAll(re)) {
      const full = match[0];
      const index = match.index;
      if (index == null || full == null) continue;
      const alt = match[1] ?? "";
      const url = match[2] ?? "";
      if (!isPreviewableUrl(url)) continue;
      const abs = from + index + full.length;
      builder.add(
        abs,
        abs,
        Decoration.widget({
          widget: new ImagePreviewWidget(url, alt),
          block: true,
          side: 1,
        }),
      );
    }
  }
  return builder.finish();
}

export function createImagePreviewExtension(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildImagePreviewDecos(view);
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildImagePreviewDecos(update.view);
          }
        }
      },
      { decorations: (value) => value.decorations },
    ),
    EditorView.theme({
      ".cm-note-image-preview": {
        display: "block",
        margin: "0.35rem 0 0.75rem",
        maxWidth: "100%",
      },
      ".cm-note-image-preview img": {
        display: "block",
        maxWidth: "100%",
        maxHeight: "280px",
        width: "auto",
        height: "auto",
        borderRadius: "0.375rem",
        border: "1px solid var(--border)",
      },
      ".cm-note-image-preview-broken": {
        fontSize: "11px",
        color: "var(--muted-foreground)",
        fontFamily: "var(--font-sans)",
      },
    }),
  ];
}
