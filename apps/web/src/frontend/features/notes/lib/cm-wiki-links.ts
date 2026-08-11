import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

import {
  displayTitle,
  filterNotesByQuery,
  findWikiLinks,
  type NoteTitleRef,
  resolveWikiLinkTarget,
} from "@features/notes/lib/wiki-links";

export type WikiLinkEditorOptions = {
  getNotes: () => readonly NoteTitleRef[];
  currentNoteId: string;
  onOpenNote: (noteId: string) => void;
};

function wikiLinkDecorator(options: WikiLinkEditorOptions) {
  return new MatchDecorator({
    regexp: /\[\[([^\]|#\n]+?)(?:#([^\]|\n]*?))?(?:\|([^\]\n]*?))?\]\]/g,
    decoration: (match) => {
      const target = match[1]?.trim() ?? "";
      if (!target) return null;
      const noteId = resolveWikiLinkTarget(
        target,
        options.getNotes(),
        options.currentNoteId,
      );
      return Decoration.mark({
        class:
          noteId != null
            ? "cm-wiki-link cm-wiki-link-resolved"
            : "cm-wiki-link cm-wiki-link-unresolved",
        attributes: {
          title: noteId != null ? "Open note" : "Note not found",
        },
      });
    },
  });
}

function linkAt(view: EditorView, clientX: number, clientY: number) {
  const pos = view.posAtCoords({ x: clientX, y: clientY });
  if (pos == null) return null;
  const line = view.state.doc.lineAt(pos);
  const offset = pos - line.from;
  return (
    findWikiLinks(line.text).find(
      (link) => offset >= link.from && offset < link.to,
    ) ?? null
  );
}

function notesFingerprint(options: WikiLinkEditorOptions): string {
  return options
    .getNotes()
    .map((note) => `${note.id}:${note.title ?? ""}`)
    .join("\0");
}

function createWikiLinkPlugin(options: WikiLinkEditorOptions) {
  const decorator = wikiLinkDecorator(options);
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      fingerprint: string;

      constructor(view: EditorView) {
        this.fingerprint = notesFingerprint(options);
        this.decorations = decorator.createDeco(view);
      }

      update(update: ViewUpdate) {
        const nextFingerprint = notesFingerprint(options);
        if (
          update.docChanged ||
          update.viewportChanged ||
          nextFingerprint !== this.fingerprint
        ) {
          this.fingerprint = nextFingerprint;
          this.decorations = decorator.createDeco(update.view);
        }
      }
    },
    {
      decorations: (value) => value.decorations,
      eventHandlers: {
        click(event, view) {
          if (event.button !== 0) return false;
          // Require mod-click so normal editing/selection still works.
          if (!(event.metaKey || event.ctrlKey)) return false;
          const hit = linkAt(view, event.clientX, event.clientY);
          if (!hit) return false;
          const noteId = resolveWikiLinkTarget(
            hit.target,
            options.getNotes(),
            options.currentNoteId,
          );
          if (!noteId) return false;
          event.preventDefault();
          options.onOpenNote(noteId);
          return true;
        },
      },
    },
  );
}

function wikiLinkCompletions(options: WikiLinkEditorOptions) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^\]\n]*$/);
    if (!match) return null;
    if (match.from === match.to && !context.explicit) return null;

    const typed = match.text.slice(2);
    if (typed.includes("]") || typed.includes("|")) return null;

    const query = typed.includes("#")
      ? typed.slice(0, typed.indexOf("#"))
      : typed;
    const notes = filterNotesByQuery(
      options.getNotes(),
      query,
      options.currentNoteId,
    );

    const completions: Completion[] = notes.map((note) => {
      const title = displayTitle(note);
      return {
        label: title,
        type: "text",
        apply: (view, _completion, from, to) => {
          view.dispatch({
            changes: { from, to, insert: `[[${title}]]` },
            selection: { anchor: from + title.length + 4 },
          });
        },
      };
    });

    return {
      from: match.from,
      options: completions,
      filter: false,
    };
  };
}

export function createWikiLinkExtensions(
  options: WikiLinkEditorOptions,
): Extension[] {
  return [
    createWikiLinkPlugin(options),
    autocompletion({
      override: [wikiLinkCompletions(options)],
      defaultKeymap: false,
    }),
    keymap.of(completionKeymap),
    wikiLinkTheme,
  ];
}

const wikiLinkTheme = EditorView.theme({
  ".cm-wiki-link": {
    borderRadius: "0.25rem",
    cursor: "pointer",
  },
  ".cm-wiki-link-resolved": {
    color: "var(--foreground)",
    backgroundColor: "color-mix(in oklab, var(--muted) 80%, transparent)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  ".cm-wiki-link-unresolved": {
    color: "var(--muted-foreground)",
    borderBottom: "1px dashed var(--muted-foreground)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    borderRadius: "0.375rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "4px 8px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
  },
});
