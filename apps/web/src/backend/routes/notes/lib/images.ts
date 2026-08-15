const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const NOTE_IMAGE_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export function isAllowedNoteImage(file: File): boolean {
  return ALLOWED_MIME_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES;
}

export function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function noteImageMarkdownUrl(imageId: string): string {
  return `/api/notes/images/${imageId}`;
}

export function noteImageR2Key(input: {
  userId: string;
  noteId: string;
  imageId: string;
  mimeType: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  return `notes/${input.userId}/${input.noteId}/${input.imageId}.${ext}`;
}
