import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";

export function SitePreviewSheet({
  item,
  className,
}: {
  item: Item;
  className?: string;
}) {
  const previewUrl = item.hasPreview
    ? `/api/items/${item.id}/preview`
    : null;

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
              <span key={tag}>{tag}</span>
            ))}
          </p>
        ) : null}
      </div>

      {previewUrl ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border border-border/40 bg-muted/30">
          <img
            src={previewUrl}
            alt={item.title ? `Preview of ${item.title}` : "Site preview"}
            className="block w-full"
          />
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border/60">
          <p className="text-xs text-muted-foreground">Capturing page…</p>
        </div>
      )}
    </div>
  );
}
