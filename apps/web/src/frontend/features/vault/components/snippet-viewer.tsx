import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { languages } from "@codemirror/language-data";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

async function languageSupport(language: string | null) {
  if (!language) return [];
  const match = languages.find(
    (entry) =>
      entry.name.toLowerCase() === language.toLowerCase() ||
      entry.alias.some((alias) => alias.toLowerCase() === language.toLowerCase()),
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
}: {
  content: string;
  language: string | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

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
          doc: content,
          extensions: [
            lineNumbers(),
            EditorView.editable.of(false),
            EditorState.readOnly.of(true),
            EditorView.theme({
              "&": {
                height: "100%",
                fontSize: "13px",
              },
              ".cm-scroller": {
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                overflow: "auto",
              },
              ".cm-content": {
                padding: "12px 0",
              },
              "&.cm-focused": {
                outline: "none",
              },
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
  }, [content, language]);

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {language ?? "plain text"}
        </span>
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(content);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden rounded-md border border-border" />
    </div>
  );
}
