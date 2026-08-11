const FRONTMATTER_RE = /^---\r?\n([\s\S]*?\r?\n)?---(?:\r?\n|$)/;

export type TitleSource = "frontmatter" | "h1" | "none";

export type ParsedNoteDocument = {
  frontmatter: string | null;
  body: string;
  title: string;
  titleSource: TitleSource;
  tags: string[];
};

export const EMPTY_NOTE_BODY = `---
title: 
tags: []
---

`;

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
  const parsed = parseFrontmatter(raw);
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

/** Sidebar / chrome label — Untitled only when there is no real name. */
export function noteDisplayTitle(title: string | null | undefined): string {
  return normalizeNoteTitle(title) ?? "Untitled";
}

/** Ensure the editor document carries a title (and empty tags) when we only had a DB title. */
export function materializeNoteBody(
  body: string,
  storedTitle: string | null | undefined,
): string {
  const doc = parseNoteDocument(body);
  if (doc.titleSource !== "none") return body;

  const title = normalizeNoteTitle(storedTitle);
  if (title) {
    return prependFrontmatter(body, { title, tags: doc.tags });
  }

  if (body.trim() === "") return EMPTY_NOTE_BODY;
  return body;
}

export function prependFrontmatter(
  body: string,
  meta: { title?: string | null; tags?: string[] },
): string {
  const lines: string[] = ["---"];
  if (meta.title != null) {
    lines.push(`title: ${formatYamlScalar(meta.title)}`);
  }
  if (meta.tags != null) {
    lines.push(`tags: [${meta.tags.map(formatYamlScalar).join(", ")}]`);
  }
  lines.push("---", "");
  const prefix = `${lines.join("\n")}`;
  if (body.length === 0) return prefix;
  return body.startsWith("\n") ? `${prefix}${body}` : `${prefix}\n${body}`;
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

function formatYamlScalar(value: string): string {
  if (value === "") return '""';
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || /\s/.test(value) || /["']/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}
