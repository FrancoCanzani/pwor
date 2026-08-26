import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function FileIcon({ className }: FileIconProps) {
  return <FileSheet className={className} accent="#737373" />;
}
