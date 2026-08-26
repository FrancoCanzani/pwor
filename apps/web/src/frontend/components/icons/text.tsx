import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function TextIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#64748b">
      <path
        fill="#64748b"
        d="M22 34h32a1.5 1.5 0 0 1 0 3H22a1.5 1.5 0 0 1 0-3zm0 9h32a1.5 1.5 0 0 1 0 3H22a1.5 1.5 0 0 1 0-3zm0 9h32a1.5 1.5 0 0 1 0 3H22a1.5 1.5 0 0 1 0-3zm0 9h20a1.5 1.5 0 0 1 0 3H22a1.5 1.5 0 0 1 0-3z"
      />
    </FileSheet>
  );
}
