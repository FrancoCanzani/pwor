import { FileSheet, type FileIconProps } from "@/components/icons/file-sheet";

export function SheetIcon({ className }: FileIconProps) {
  return (
    <FileSheet className={className} accent="#217346">
      <path
        fill="#217346"
        d="M22 34h28v28H22zm3 3v7h10V37zm13 0v7h9V37zm-13 10v7h10v-7zm13 0v7h9v-7zm-13 10v5h10v-5zm13 0v5h9v-5z"
      />
    </FileSheet>
  );
}
