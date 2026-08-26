import {
  DOCUMENT_FORMAT,
  DOCUMENT_VERSION,
  documentTitle,
  documentToPlainText,
  documentToPreview,
  isDocumentJSON,
  isEmptyDocument,
  type DocumentJSON,
} from "@pwor/editor/document";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?\r?\n)?---(?:\r?\n|$)/;

export type StoredTiptapBody = {
  format: typeof DOCUMENT_FORMAT;
  v: number;
  noted?: boolean;
  doc: DocumentJSON;
};

export type StoredNoteBody =
  | { kind: "tiptap"; doc: DocumentJSON; noted: boolean }
  | { kind: "markdown"; raw: string; noted: boolean };

export type TitleSource = "frontmatter" | "h1" | "none";

export type ParsedNoteDocument = {
  frontmatter: string | null;
  body: string;
  title: string;
  titleSource: TitleSource;
  tags: string[];
};

export const EMPTY_NOTE_BODY = "";

function isStoredTiptapBody(value: unknown): value is StoredTiptapBody {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.format === DOCUMENT_FORMAT &&
    typeof record.v === "number" &&
    isDocumentJSON(record.doc)
  );
}

export function readStoredNote(raw: string): StoredNoteBody {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { kind: "markdown", raw, noted: false };
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredTiptapBody(parsed)) {
        return {
          kind: "tiptap",
          doc: parsed.doc,
          noted: parsed.noted === true,
        };
      }
    } catch {
      // Fall through to markdown.
    }
  }
  return {
    kind: "markdown",
    raw,
    noted: markdownIsNoted(raw),
  };
}

export function serializeTiptapBody(
  doc: DocumentJSON,
  noted = false,
): string {
  const payload: StoredTiptapBody = {
    format: DOCUMENT_FORMAT,
    v: DOCUMENT_VERSION,
    ...(noted ? { noted: true } : {}),
    doc,
  };
  return JSON.stringify(payload);
}

export function noteHasBody(raw: string): boolean {
  const stored = readStoredNote(raw);
  if (stored.kind === "tiptap") return !isEmptyDocument(stored.doc);
  return parseMarkdownDocument(stored.raw).body.trim().length > 0;
}

export function noteBodyPreview(raw: string, max = 280): string | null {
  const stored = readStoredNote(raw);
  if (stored.kind === "tiptap") return documentToPreview(stored.doc, max);
  const text = parseMarkdownDocument(stored.raw)
    .body.replace(/\s+/g, " ")
    .trim();
  if (text.length === 0) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function parseFrontmatter(raw: string): {
  frontmatter: string | null;
  body: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: null, body: raw };
  const fm = match[1] ? match[1].replace(/\r?\n$/, "") : "";
  return { frontmatter: fm, body: raw.slice(match[0].length) };
}

export function parseNoteDocument(raw: string): ParsedNoteDocument {
  const stored = readStoredNote(raw);
  if (stored.kind === "tiptap") {
    const title = documentTitle(stored.doc);
    return {
      frontmatter: null,
      body: documentToPlainText(stored.doc),
      title,
      titleSource: title.length > 0 ? "h1" : "none",
      tags: [],
    };
  }
  return parseMarkdownDocument(stored.raw);
}

function parseMarkdownDocument(raw: string): ParsedNoteDocument {
  const parsed = parseFrontmatter(raw);
  const { title, titleSource } = inferTitle(parsed.body, parsed.frontmatter);
  return {
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    title,
    titleSource,
    tags: getFrontmatterTags(parsed.frontmatter),
  };
}

export function inferTitle(
  body: string,
  frontmatter: string | null,
): { title: string; titleSource: TitleSource } {
  const frontmatterTitle = getFrontmatterTitle(frontmatter);
  if (frontmatterTitle !== null) {
    return { title: frontmatterTitle, titleSource: "frontmatter" };
  }

  const leadingHeading = getLeadingHeadingTitle(body);
  if (leadingHeading !== null) {
    return { title: leadingHeading, titleSource: "h1" };
  }

  return { title: "", titleSource: "none" };
}

export function inferTitleFromRaw(raw: string): {
  title: string;
  titleSource: TitleSource;
} {
  const stored = readStoredNote(raw);
  if (stored.kind === "tiptap") {
    const title = documentTitle(stored.doc);
    return {
      title,
      titleSource: title.length > 0 ? "h1" : "none",
    };
  }
  const parsed = parseFrontmatter(stored.raw);
  return inferTitle(parsed.body, parsed.frontmatter);
}

export function normalizeNoteTitle(title: string | null | undefined): string | null {
  if (title == null) return null;
  const trimmed = title.trim();
  if (trimmed.length === 0) return null;
  // Guard against corrupted frontmatter leaking into the title column.
  if (/^tags:\s*\[.*\]$/.test(trimmed)) return null;
  return trimmed;
}

export function noteDisplayTitle(title: string | null | undefined): string {
  return normalizeNoteTitle(title) ?? "Untitled";
}

export function noteIsNoted(raw: string): boolean {
  if (noteHasBody(raw)) return true;
  return readStoredNote(raw).noted;
}

function markdownIsNoted(raw: string): boolean {
  if (parseMarkdownDocument(raw).body.trim().length > 0) return true;
  const { frontmatter } = parseFrontmatter(raw);
  return Boolean(frontmatter && /^noted:\s*true\s*$/m.test(frontmatter));
}

export function withNotedFlag(raw: string): string {
  if (noteIsNoted(raw)) {
    const stored = readStoredNote(raw);
    if (stored.kind === "tiptap") return serializeTiptapBody(stored.doc, true);
    return raw;
  }
  const stored = readStoredNote(raw);
  if (stored.kind === "tiptap") return serializeTiptapBody(stored.doc, true);
  const { frontmatter, body } = parseFrontmatter(stored.raw);
  if (frontmatter == null || frontmatter.trim() === "") {
    return `---\nnoted: true\n---\n${body}`;
  }
  const next = /^noted:\s*/m.test(frontmatter)
    ? frontmatter.replace(/^noted:\s*.*$/m, "noted: true")
    : `${frontmatter.replace(/\s+$/, "")}\nnoted: true`;
  return `---\n${next}\n---\n${body}`;
}

export function dropNotedFlag(raw: string): string {
  const stored = readStoredNote(raw);
  if (stored.kind === "tiptap") {
    return serializeTiptapBody(stored.doc, false);
  }
  const { frontmatter, body } = parseFrontmatter(stored.raw);
  if (frontmatter == null || !/^noted:\s*/m.test(frontmatter)) return raw;
  const next = frontmatter
    .replace(/^noted:\s*.*$/m, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .join("\n");
  if (next === "") return body;
  return `---\n${next}\n---\n${body}`;
}

function getFrontmatterTitle(frontmatter: string | null): string | null {
  if (frontmatter == null) return null;
  const match = frontmatter.match(/^title:\s*(.*)$/m);
  if (!match) return null;
  const value = parseYamlScalar(match[1] ?? "");
  if (value === "" || /^tags:\s*\[/.test(value)) return null;
  return value;
}

function getFrontmatterTags(frontmatter: string | null): string[] {
  if (frontmatter == null || frontmatter.trim() === "") return [];

  const inline = frontmatter.match(/^tags:\s*\[(.*)\]\s*$/m);
  if (inline) {
    return splitYamlList(inline[1] ?? "");
  }

  const blockHeader = frontmatter.match(/^tags:\s*(?:#.*)?$/m);
  if (!blockHeader || blockHeader.index == null) return [];

  const after = frontmatter.slice(blockHeader.index + blockHeader[0].length);
  const tags: string[] = [];
  for (const line of after.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const item = line.match(/^[ \t]+-\s+(.*)$/);
    if (!item) break;
    const value = parseYamlScalar(item[1] ?? "");
    if (value) tags.push(value);
  }
  return tags;
}

function getLeadingHeadingTitle(body: string): string | null {
  const afterBlankLines = body.replace(/^(?:[ \t]*\r?\n)*/, "");
  const newlineIndex = afterBlankLines.search(/\r?\n/);
  const firstLine =
    newlineIndex === -1 ? afterBlankLines : afterBlankLines.slice(0, newlineIndex);
  const match = firstLine.match(/^#\s+(.*)$/);
  if (!match) return null;
  const title = (match[1] ?? "").replace(/\s+#+\s*$/, "").trim();
  return title === "" ? null : title;
}

function splitYamlList(raw: string): string[] {
  if (raw.trim() === "") return [];
  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ",") {
      const value = parseYamlScalar(current);
      if (value) items.push(value);
      current = "";
      continue;
    }
    current += ch;
  }
  const last = parseYamlScalar(current);
  if (last) items.push(last);
  return items;
}

function parseYamlScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "~" || trimmed === "null") return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  const withoutComment = trimmed.replace(/\s+#.*$/, "").trim();
  return withoutComment;
}
