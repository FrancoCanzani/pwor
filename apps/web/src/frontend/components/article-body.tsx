import { cn } from "@/lib/utils";

export const articleProseClassName = cn(
  "text-sm leading-relaxed text-foreground",
  "[&_a]:underline [&_a]:underline-offset-2",
  "[&_p]:mb-4",
  "[&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-bold",
  "[&_h2]:mb-3 [&_h2]:text-sm [&_h2]:font-bold",
  "[&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-bold",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:mb-1",
  "[&_blockquote]:mb-4 [&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs",
  "[&_code]:font-mono [&_code]:text-xs",
  "[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-md",
  "[&_figure]:mb-4",
  "[&_hr]:my-6 [&_hr]:border-border",
);

export function ArticleBody({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(articleProseClassName, className)}
      // HTML is sanitized on the server (feed ingest / Readability pipeline).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
