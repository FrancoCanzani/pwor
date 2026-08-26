import { ArchiveIcon } from "@/components/icons/archive";
import { AudioIcon } from "@/components/icons/audio";
import { FileIcon } from "@/components/icons/file";
import type { FileIconProps } from "@/components/icons/file-sheet";
import { ImageIcon } from "@/components/icons/image";
import { PdfIcon } from "@/components/icons/pdf";
import { SheetIcon } from "@/components/icons/sheet";
import { SlidesIcon } from "@/components/icons/slides";
import { TextIcon } from "@/components/icons/text";
import { VideoIcon } from "@/components/icons/video";
import { WordIcon } from "@/components/icons/word";
import type { Item } from "@features/items/api";
import { isTextPreviewable } from "@features/items/lib/preview";
import { isSheetPreviewable } from "@features/items/lib/sheet";

export type FileIconKind =
  | "pdf"
  | "word"
  | "sheet"
  | "slides"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "archive"
  | "file";

const WORD_MIME = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/rtf",
]);

const WORD_EXT = new Set(["doc", "docx", "odt", "rtf"]);

const SLIDES_MIME = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
]);

const SLIDES_EXT = new Set(["ppt", "pptx", "odp", "key"]);

const ARCHIVE_MIME = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
]);

const ARCHIVE_EXT = new Set([
  "zip",
  "rar",
  "7z",
  "gz",
  "tgz",
  "tar",
]);

function extensionOf(title: string | null): string | null {
  if (!title?.includes(".")) return null;
  return title.slice(title.lastIndexOf(".") + 1).toLowerCase();
}

export function fileIconKindOf(
  item: Pick<Item, "kind" | "mimeType" | "title">,
): FileIconKind {
  switch (item.kind) {
    case "text":
      return "text";
    case "link":
      return "file";
    case "file":
      break;
    default: {
      const _exhaustive: never = item.kind;
      return _exhaustive;
    }
  }

  const mime = item.mimeType?.toLowerCase().split(";")[0]?.trim() ?? "";
  const ext = extensionOf(item.title);

  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (WORD_MIME.has(mime) || (ext !== null && WORD_EXT.has(ext))) return "word";
  if (isSheetPreviewable(item.mimeType, item.title)) return "sheet";
  if (SLIDES_MIME.has(mime) || (ext !== null && SLIDES_EXT.has(ext))) {
    return "slides";
  }
  if (ARCHIVE_MIME.has(mime) || (ext !== null && ARCHIVE_EXT.has(ext))) {
    return "archive";
  }
  if (isTextPreviewable(item.mimeType, item.title)) return "text";
  return "file";
}

export function FileTypeIcon({
  item,
  className,
}: {
  item: Pick<Item, "kind" | "mimeType" | "title">;
} & FileIconProps) {
  const kind = fileIconKindOf(item);
  switch (kind) {
    case "pdf":
      return <PdfIcon className={className} />;
    case "word":
      return <WordIcon className={className} />;
    case "sheet":
      return <SheetIcon className={className} />;
    case "slides":
      return <SlidesIcon className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <VideoIcon className={className} />;
    case "audio":
      return <AudioIcon className={className} />;
    case "text":
      return <TextIcon className={className} />;
    case "archive":
      return <ArchiveIcon className={className} />;
    case "file":
      return <FileIcon className={className} />;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
