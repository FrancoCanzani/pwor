import { ContentReader } from "@/components/content-reader";
import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";

export function ItemReader({
  item,
  content,
  className,
}: {
  item: Item;
  content: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-4 overflow-hidden",
        className ?? "max-h-[75vh]",
      )}
    >
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
        {item.summary ? (
          <p className="text-sm text-foreground">{item.summary}</p>
        ) : null}
        {item.tags && item.tags.length > 0 ? (
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {item.tags.map((tag) => (
              <span key={tag} className="capitalize">
                {tag}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {content ? (
        <ContentReader
          target={{ itemId: item.id }}
          markdown={content}
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border/60">
          <p className="text-xs text-muted-foreground">
            {item.parseStatus === "failed"
              ? "Couldn't extract this page."
              : "Extracting content…"}
          </p>
        </div>
      )}
    </div>
  );
}
