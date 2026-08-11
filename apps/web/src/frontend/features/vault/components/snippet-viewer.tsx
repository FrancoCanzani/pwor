import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  displayLanguageLabel,
  SNIPPET_LANGUAGE_OPTIONS,
} from "@shared/snippet-format";
import { toast } from "sonner";

const snippetHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--foreground)", fontWeight: "700" },
  { tag: tags.controlKeyword, color: "var(--foreground)", fontWeight: "700" },
  { tag: tags.definitionKeyword, color: "var(--foreground)", fontWeight: "700" },
  { tag: tags.moduleKeyword, color: "var(--foreground)", fontWeight: "700" },
  { tag: tags.operatorKeyword, color: "var(--muted-foreground)" },
  { tag: tags.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: tags.lineComment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: tags.blockComment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: tags.string, color: "var(--muted-foreground)" },
  { tag: tags.special(tags.string), color: "var(--muted-foreground)" },
  { tag: tags.number, color: "var(--foreground)" },
  { tag: tags.bool, color: "var(--foreground)" },
  { tag: tags.null, color: "var(--muted-foreground)" },
  { tag: tags.regexp, color: "var(--muted-foreground)" },
  { tag: tags.variableName, color: "var(--foreground)" },
  { tag: tags.definition(tags.variableName), color: "var(--foreground)" },
  { tag: tags.propertyName, color: "var(--foreground)" },
  { tag: tags.attributeName, color: "var(--muted-foreground)" },
  { tag: tags.attributeValue, color: "var(--muted-foreground)" },
  { tag: tags.tagName, color: "var(--foreground)", fontWeight: "700" },
  { tag: tags.typeName, color: "var(--muted-foreground)" },
  { tag: tags.className, color: "var(--foreground)" },
  { tag: tags.namespace, color: "var(--muted-foreground)" },
  { tag: tags.operator, color: "var(--muted-foreground)" },
  { tag: tags.punctuation, color: "var(--muted-foreground)" },
  { tag: tags.bracket, color: "var(--muted-foreground)" },
  { tag: tags.meta, color: "var(--muted-foreground)" },
  { tag: tags.invalid, color: "var(--destructive)" },
]);

const snippetTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    overflow: "auto",
    lineHeight: "1.55",
  },
  ".cm-content": {
    padding: "12px 0",
    caretColor: "var(--foreground)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "2.5rem",
    padding: "0 8px 0 12px",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "var(--muted) !important",
    },
});

async function languageSupport(language: string | null) {
  if (!language) return [];
  const needle = language.toLowerCase();
  const match = languages.find(
    (entry) =>
      entry.name.toLowerCase() === needle ||
      entry.alias.some((alias) => alias.toLowerCase() === needle),
  );
  if (!match) return [];
  try {
    const support = await match.load();
    return [support];
  } catch {
    return [];
  }
}

export function SnippetViewer({
  content,
  language,
  onContentChange,
  onLanguageChange,
}: {
  content: string;
  language: string | null;
  onContentChange?: (content: string) => void;
  onLanguageChange?: (language: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const contentRef = useRef(content);
  contentRef.current = content;
  const editable = Boolean(onContentChange);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let view: EditorView | null = null;

    void (async () => {
      const lang = await languageSupport(language);
      if (cancelled || !hostRef.current) return;

      view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: contentRef.current,
          extensions: [
            lineNumbers(),
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
            syntaxHighlighting(snippetHighlight),
            snippetTheme,
            EditorView.editable.of(editable),
            EditorState.readOnly.of(!editable),
            EditorView.updateListener.of((update) => {
              if (!update.docChanged) return;
              onContentChangeRef.current?.(update.state.doc.toString());
            }),
            ...lang,
          ],
        }),
      });
      viewRef.current = view;
    })();

    return () => {
      cancelled = true;
      view?.destroy();
      viewRef.current = null;
    };
  }, [language, editable]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === content) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: content },
    });
  }, [content]);

  const languageOptions: { value: string; label: string }[] = [
    ...SNIPPET_LANGUAGE_OPTIONS,
  ];
  if (
    language &&
    !languageOptions.some((option) => option.value === language)
  ) {
    languageOptions.unshift({
      value: language,
      label: displayLanguageLabel(language),
    });
  }

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        {onLanguageChange ? (
          <select
            aria-label="Language"
            value={language ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              onLanguageChange(next ? next : null);
            }}
            className="h-7 max-w-[10rem] rounded-md border border-input bg-transparent px-2 text-xs text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
          >
            <option value="">plain text</option>
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">
            {displayLanguageLabel(language)}
          </span>
        )}
        <Button
          variant="outline"
          onClick={() => {
            const text = viewRef.current?.state.doc.toString() ?? content;
            void navigator.clipboard.writeText(text);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
      </div>
      <div
        ref={hostRef}
        className="min-h-0 flex-1 overflow-hidden rounded-md border border-border"
      />
    </div>
  );
}
