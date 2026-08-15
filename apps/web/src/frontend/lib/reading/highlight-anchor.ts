import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import DiffMatchPatch from "diff-match-patch";

const CONTEXT_CHARS = 120;
const MARKER_START = "";
const MARKER_END = "";
const BLOCK_SEPARATOR = "\n";

export type HighlightAnchor = {
  from: number;
  to: number;
  quote: string;
  prefix: string;
  suffix: string;
  patch: string;
};

function fullText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, BLOCK_SEPARATOR, BLOCK_SEPARATOR);
}

export function createAnchor(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): HighlightAnchor {
  const text = fullText(doc);
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

  const snippetIndex = text.indexOf(prefix + quote + suffix);
  let patch = "";
  if (snippetIndex !== -1) {
    const markedFrom = snippetIndex + prefix.length;
    const marked =
      text.slice(0, markedFrom) +
      MARKER_START +
      quote +
      MARKER_END +
      text.slice(markedFrom + quote.length);
    const dmp = new DiffMatchPatch();
    patch = dmp.patch_toText(dmp.patch_make(text, marked));
  }

  return { from, to, quote, prefix, suffix, patch };
}

function charOffsetToPos(doc: ProseMirrorNode, charOffset: number): number {
  let lo = 0;
  let hi = doc.content.size;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const len = doc.textBetween(0, mid, BLOCK_SEPARATOR, BLOCK_SEPARATOR).length;
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

  if (!anchor.patch) return null;

  const dmp = new DiffMatchPatch();
  const patches = dmp.patch_fromText(anchor.patch);
  const [patched, results] = dmp.patch_apply(patches, fullText(doc));
  if (!results.every(Boolean)) return null;

  const startIdx = patched.indexOf(MARKER_START);
  const endIdx = patched.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;

  const charFrom = startIdx;
  const charTo = endIdx - MARKER_START.length;
  const from = charOffsetToPos(doc, charFrom);
  const to = charOffsetToPos(doc, charTo);
  if (from > to) return null;
  return { from, to };
}
