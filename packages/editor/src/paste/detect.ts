import { isMarkActive } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";

export function clipboardText(event: ClipboardEvent): string {
  const data = event.clipboardData;
  if (!data) return "";
  return (data.getData("text/plain") || data.getData("text/uri-list")).trim();
}

export function isUrl(text: string): boolean {
  if (text.length === 0 || /\s/.test(text)) return false;
  try {
    const url = new URL(text);
    if (url.protocol === "javascript:" || url.protocol === "data:" || url.protocol === "vbscript:" || url.protocol === "file:") {
      return false;
    }
    return url.hostname.length > 0 || url.protocol === "mailto:" || url.protocol === "tel:";
  } catch {
    return false;
  }
}

export function isInCode(state: EditorState): boolean {
  if (state.selection.$from.parent.type.spec.code) return true;
  const code = state.schema.marks.code;
  return code ? isMarkActive(state, code) : false;
}

export function isInList(state: EditorState): boolean {
  const $head = state.selection.$head;
  for (let depth = $head.depth; depth > 0; depth -= 1) {
    const name = $head.node(depth).type.name;
    if (name === "orderedList" || name === "bulletList" || name === "taskList") {
      return true;
    }
  }
  return false;
}

export function isEmptyParagraph(state: EditorState): boolean {
  const parent = state.selection.$from.parent;
  return parent.type.name === "paragraph" && parent.content.size === 0;
}

export function parseIframeSrc(html: string): string | undefined {
  if (!html.includes("<iframe")) return undefined;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.body.children.length !== 1) return undefined;
    const iframe = doc.body.firstElementChild;
    if (iframe?.tagName !== "IFRAME") return undefined;
    return iframe.getAttribute("src") ?? undefined;
  } catch {
    return undefined;
  }
}

export function isMarkdown(text: string): boolean {
  const fences = text.match(/^```/gm);
  if (fences && fences.length > 1) return true;
  if (text.match(/\[[^]+\]\(https?:\/\/\S+\)/gm)) return true;
  if (text.match(/^#{1,6}\s+\S+/gm)) return true;
  const listItems = text.match(/^([-*]|\d+\.)\s\S+/gm);
  if (listItems && listItems.length > 1) return true;
  const tables = text.match(/\|\s?[-]+\s?\|/gm);
  if (tables && tables.length > 1) return true;
  return false;
}

export function vscodeLanguage(event: ClipboardEvent): string | undefined {
  const raw = event.clipboardData?.getData("vscode-editor-data");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { mode?: unknown };
    return typeof parsed.mode === "string" ? parsed.mode : undefined;
  } catch {
    return undefined;
  }
}
