import { isTextPreviewable } from "@features/packs/lib/preview";
import { isSheetPreviewable } from "@features/packs/lib/sheet";

type SourceKindInput = {
  type: "file" | "text" | "url";
  mimeType: string | null;
  title: string | null;
  filename: string | null;
};

function displayName(item: SourceKindInput) {
  return item.title || item.filename;
}

/** Short human label for a source (PDF, Image, URL, …). */
export function sourceKindLabel(item: SourceKindInput): string {
  if (item.type === "url") return "URL";
  if (item.type === "text") return "Text";

  const name = displayName(item);
  const mime = item.mimeType?.toLowerCase().split(";")[0]?.trim() ?? "";

  if (mime === "application/pdf" || name?.toLowerCase().endsWith(".pdf")) {
    return "PDF";
  }
  if (isSheetPreviewable(item.mimeType, name)) return "Spreadsheet";
  if (mime.startsWith("image/")) {
    const subtype = mime.slice("image/".length).toUpperCase();
    if (subtype === "JPEG" || subtype === "JPG") return "JPEG";
    if (subtype === "SVG+XML") return "SVG";
    if (subtype) return subtype;
    return "Image";
  }
  if (isTextPreviewable(item.mimeType, name)) return "Text file";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  return "File";
}

export function formatBytes(size: number | null) {
  if (size == null || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function originalUrl(packId: string, sourceId: string) {
  return `/api/packs/${packId}/sources/${sourceId}/original`;
}
