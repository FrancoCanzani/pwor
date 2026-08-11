import { isCodeSnippetFile, isMarkdownFile } from "./snippet-language";

/** How a dropped / chosen file should be captured. */
export type IngestKind = "note" | "snippet" | "file";

/**
 * Single policy for file capture across create dialog, drop zone, and server upload.
 * Markdown → note, code → snippet, everything else → vault file.
 */
export function classifyIngestFile(
  filename: string,
  mimeType?: string | null,
): IngestKind {
  if (isMarkdownFile(filename, mimeType)) return "note";
  if (isCodeSnippetFile(filename, mimeType)) return "snippet";
  return "file";
}
