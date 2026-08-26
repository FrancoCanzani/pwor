import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function VideoIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#e11d48">
      <path fill="#e11d48" d="M30 34v28l22-14z" />
    </FileSheet>
  );
}
