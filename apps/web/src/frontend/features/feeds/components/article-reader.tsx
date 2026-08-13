import { ExternalLinkIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import type { FeedItem } from "@features/feeds/api";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-2xl px-4 pt-8 pb-20",
        className,
      )}
    >
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-xl font-normal tracking-tight text-balance">
          {title}
        </h1>
        <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {source ? <span>{source}</span> : null}
            {item.publishedAt ? (
              <span className="font-nums">{formatDate(item.publishedAt)}</span>
            ) : null}
          </div>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open original"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLinkIcon className="size-3.5" />
            </a>
          ) : null}
        </div>
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

      {item.contentHtml ? (
        <div
          className={cn(
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
          )}
          // Feed HTML is sanitized on ingest.
          dangerouslySetInnerHTML={{ __html: item.contentHtml }}
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
