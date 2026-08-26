import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function AudioIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#7c3aed">
      <path
        fill="#7c3aed"
        d="M24 44h5v16h-5zm8-8h5v24h-5zm8 12h5v12h-5zm8-6h5v18h-5z"
      />
    </FileSheet>
  );
}
