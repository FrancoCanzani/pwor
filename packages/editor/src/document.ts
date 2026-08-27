export const DOCUMENT_FORMAT = "tiptap";
export const DOCUMENT_VERSION = 1;

export type DocumentMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type DocumentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocumentNode[];
  marks?: DocumentMark[];
  text?: string;
};

export type DocumentJSON = {
  type: "doc";
  attrs?: Record<string, unknown>;
  content?: DocumentNode[];
};

const BLOCK_BREAK = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "callout",
  "listItem",
  "taskItem",
  "horizontalRule",
]);

export function emptyDocument(): DocumentJSON {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function isDocumentJSON(value: unknown): value is DocumentJSON {
  if (value === null || typeof value !== "object") return false;
  const record = value as { type?: unknown; content?: unknown };
  if (record.type !== "doc") return false;
  return record.content === undefined || Array.isArray(record.content);
}

export function isEmptyDocument(doc: DocumentJSON): boolean {
  return !hasVisibleContent(doc);
}

export function documentToPlainText(doc: DocumentJSON): string {
  const parts: string[] = [];
  writePlainText(doc, parts);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function documentToPreview(
  doc: DocumentJSON,
  max = 280,
): string | null {
  const text = documentToPlainText(doc).replace(/\s+/g, " ").trim();
  if (text.length === 0) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function documentTitle(doc: DocumentJSON): string {
  for (const node of doc.content ?? []) {
    if (node.type !== "heading") continue;
    const text = documentToPlainText({ type: "doc", content: [node] });
    if (text.length > 0) return text;
  }
  return "";
}

export function documentsEqual(a: DocumentJSON, b: DocumentJSON): boolean {
  return JSON.stringify(normalizeNode(a)) === JSON.stringify(normalizeNode(b));
}

function hasVisibleContent(node: DocumentNode): boolean {
  if (node.type === "text") return (node.text ?? "").trim().length > 0;
  if (node.type === "mention") {
    const label = node.attrs?.label;
    return typeof label === "string" && label.trim().length > 0;
  }
  if (node.type === "image") {
    const src = node.attrs?.src;
    return typeof src === "string" && src.length > 0;
  }
  if (node.type === "youtube" || node.type === "tweet") {
    const src = node.attrs?.src;
    return typeof src === "string" && src.length > 0;
  }
  if (node.type === "horizontalRule") return true;
  return (node.content ?? []).some(hasVisibleContent);
}

function normalizeAttrs(
  attrs: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!attrs) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "blockId" || value == null) continue;
    next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeMark(mark: DocumentMark): unknown {
  const attrs = normalizeAttrs(mark.attrs);
  return attrs ? { type: mark.type, attrs } : { type: mark.type };
}

function normalizeNode(node: DocumentNode): unknown {
  const attrs = normalizeAttrs(node.attrs);
  const marks = node.marks?.map(normalizeMark);
  const content = node.content?.map(normalizeNode);
  return {
    type: node.type,
    ...(attrs ? { attrs } : {}),
    ...(node.text ? { text: node.text } : {}),
    ...(marks && marks.length > 0 ? { marks } : {}),
    ...(content && content.length > 0 ? { content } : {}),
  };
}

function writePlainText(node: DocumentNode, out: string[]): void {
  switch (node.type) {
    case "text":
      if (node.text) out.push(node.text);
      return;
    case "hardBreak":
      out.push("\n");
      return;
    case "mention": {
      const label = node.attrs?.label;
      if (typeof label === "string" && label.length > 0) out.push(label);
      return;
    }
    case "image": {
      const alt = node.attrs?.alt;
      if (typeof alt === "string" && alt.trim().length > 0) out.push(alt);
      return;
    }
    case "youtube": {
      const src = node.attrs?.src;
      if (typeof src === "string" && src.length > 0) {
        out.push(`https://youtu.be/${src}`);
      }
      return;
    }
    case "tweet": {
      const src = node.attrs?.src;
      if (typeof src === "string" && src.length > 0) {
        out.push(`https://x.com/i/status/${src}`);
      }
      return;
    }
    case "horizontalRule":
      out.push("\n");
      return;
    default:
      break;
  }

  for (const child of node.content ?? []) {
    writePlainText(child, out);
  }

  if (BLOCK_BREAK.has(node.type)) out.push("\n");
}
