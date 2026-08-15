import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const CONTEXT_CHARS = 120;
const BLOCK_SEPARATOR = "\n";

export type HighlightAnchor = {
  from: number;
  to: number;
  quote: string;
  prefix: string;
  suffix: string;
};

function fullText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, BLOCK_SEPARATOR, BLOCK_SEPARATOR);
}

export function createAnchor(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): HighlightAnchor {
  const quote = doc.textBetween(from, to, BLOCK_SEPARATOR, BLOCK_SEPARATOR);
  const prefix = doc.textBetween(
    Math.max(0, from - CONTEXT_CHARS),
    from,
    BLOCK_SEPARATOR,
    BLOCK_SEPARATOR,
  );
  const suffix = doc.textBetween(
    to,
    Math.min(doc.content.size, to + CONTEXT_CHARS),
    BLOCK_SEPARATOR,
    BLOCK_SEPARATOR,
  );

  return { from, to, quote, prefix, suffix };
}

function charOffsetToPos(doc: ProseMirrorNode, charOffset: number): number {
  let lo = 0;
  let hi = doc.content.size;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const len = doc.textBetween(0, mid, BLOCK_SEPARATOR, BLOCK_SEPARATOR)
      .length;
    if (len < charOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function resolveAnchor(
  doc: ProseMirrorNode,
  anchor: HighlightAnchor,
): { from: number; to: number } | null {
  const maxPos = doc.content.size;
  if (anchor.from >= 0 && anchor.to <= maxPos && anchor.from <= anchor.to) {
    const current = doc.textBetween(
      anchor.from,
      anchor.to,
      BLOCK_SEPARATOR,
      BLOCK_SEPARATOR,
    );
    if (current === anchor.quote) return { from: anchor.from, to: anchor.to };
  }

  const text = fullText(doc);
  const needle = `${anchor.prefix}${anchor.quote}${anchor.suffix}`;
  const snippetIndex = text.indexOf(needle);
  if (snippetIndex === -1) return null;

  const charFrom = snippetIndex + anchor.prefix.length;
  const charTo = charFrom + anchor.quote.length;
  const from = charOffsetToPos(doc, charFrom);
  const to = charOffsetToPos(doc, charTo);
  if (from > to) return null;
  return { from, to };
}
