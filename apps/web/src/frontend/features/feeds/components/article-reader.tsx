import { format, isValid } from "date-fns";

import { cn } from "@/lib/utils";
import type { FeedItem } from "@features/feeds/api";
import { ContentReader } from "@features/reading/content-reader";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!isValid(date)) return "";
  return format(date, "MMM d, yyyy");
}

export function ArticleReader({
  item,
  className,
}: {
  item: FeedItem;
  className?: string;
}) {
  const title = item.title?.trim() || "Untitled";
  const source = item.feedTitle?.trim() || item.author?.trim() || null;
  const isYoutube = item.feedKind === "youtube" || Boolean(item.videoId);
  const content = item.contentHtml?.trim() || "";

  return (
    <article
      className={cn("mx-auto w-full max-w-2xl px-4 pt-3 pb-20", className)}
    >
      <header className="mb-8 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {source ? <span>{source}</span> : null}
        {item.publishedAt ? (
          <span className="font-nums">{formatDate(item.publishedAt)}</span>
        ) : null}
      </header>

      {isYoutube && item.videoId ? (
        <div className="mb-8 aspect-video w-full overflow-hidden rounded-md border border-border/40 bg-muted">
          <iframe
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${item.videoId}`}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      {!isYoutube && item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="mb-8 max-h-80 w-full rounded-md object-cover"
        />
      ) : null}

      {content ? (
        <ContentReader
          target={{ feedItemId: item.id }}
          content={content}
          contained={false}
        />
      ) : item.summary ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {item.summary}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No content.</p>
      )}
    </article>
  );
}
