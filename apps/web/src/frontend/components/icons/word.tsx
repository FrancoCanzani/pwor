import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function WordIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#2b579a">
      <path
        fill="#2b579a"
        d="M22 36h32a1.5 1.5 0 0 1 0 3H22a1.5 1.5 0 0 1 0-3zm0 10h32a1.5 1.5 0 0 1 0 3H22a1.5 1.5 0 0 1 0-3zm0 10h22a1.5 1.5 0 0 1 0 3H22a1.5 1.5 0 0 1 0-3z"
      />
    </FileSheet>
  );
}
