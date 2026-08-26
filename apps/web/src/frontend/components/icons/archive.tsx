import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function ArchiveIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#ca8a04">
      <path
        fill="#ca8a04"
        d="M35 32h6v5h-6zm0 8h6v5h-6zm0 8h6v5h-6zm0 8h6v5h-6zm0 8h6v6h-6z"
      />
    </FileSheet>
  );
}
