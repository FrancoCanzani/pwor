import { generateJSON } from "@tiptap/core";
import {
  emptyDocument,
  isDocumentJSON,
  type DocumentJSON,
} from "./document";
import { createDocumentSchema } from "./schema";

export function documentFromHTML(html: string): DocumentJSON {
  const trimmed = html.trim();
  if (trimmed.length === 0) return emptyDocument();
  const json = generateJSON(trimmed, createDocumentSchema());
  return isDocumentJSON(json) ? json : emptyDocument();
}
