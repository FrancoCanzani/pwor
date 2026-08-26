import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function SlidesIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#d24726">
      <path
        fill="#d24726"
        d="M20 38h36a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V40a2 2 0 0 1 2-2zm2 4v14h32V42z"
      />
    </FileSheet>
  );
}
