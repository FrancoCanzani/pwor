import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function ImageIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#0284c7">
      <circle cx="48" cy="38" r="5" fill="#0284c7" />
      <path fill="#0284c7" d="m18 66 14-20 10 12 8-14 12 22z" />
    </FileSheet>
  );
}
