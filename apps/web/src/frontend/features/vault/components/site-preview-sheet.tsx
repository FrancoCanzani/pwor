import { ArticleBody } from "@/components/article-body";
import type { VaultItem } from "@features/vault/api";

export function SitePreviewSheet({
  item,
  content,
  contentHtml,
}: {
  item: VaultItem;
  content: string | null;
  contentHtml?: string | null;
}) {
  const previewUrl = item.hasPreview
    ? `/api/vault/${item.id}/preview`
    : null;
  const pending = item.parseStatus === "pending" && !previewUrl && !contentHtml;
  const articleHtml = contentHtml?.trim() || null;

  return (
    <div className="flex max-h-[75vh] flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 px-0.5">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {item.url}
          </a>
        ) : null}
        {item.summary && !articleHtml ? (
          <p className="text-sm text-foreground">{item.summary}</p>
        ) : null}
        {item.tags && item.tags.length > 0 ? (
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {item.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain">
        {articleHtml ? (
          <ArticleBody html={articleHtml} className="px-0.5" />
        ) : null}

        {previewUrl ? (
          <div className="overflow-hidden rounded-md border border-border/40 bg-muted/30">
            <img
              src={previewUrl}
              alt={item.title ? `Preview of ${item.title}` : "Site preview"}
              className="block w-full"
            />
          </div>
        ) : null}

        {!articleHtml && !previewUrl && pending ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border/60">
            <p className="text-xs text-muted-foreground">Reading page…</p>
          </div>
        ) : null}

        {!articleHtml && !previewUrl && !pending && content ? (
          <pre className="whitespace-pre-wrap px-0.5 text-sm text-muted-foreground">
            {content}
          </pre>
        ) : null}

        {!articleHtml && !previewUrl && !pending && !content ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-xs text-muted-foreground">No preview yet.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
