import type { VaultItem } from "@features/vault/api";

export function SitePreviewSheet({
  item,
  content,
}: {
  item: VaultItem;
  content: string | null;
}) {
  const previewUrl = item.hasPreview
    ? `/api/vault/${item.id}/preview`
    : null;
  const pending = item.parseStatus === "pending" && !previewUrl;

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
      ) : pending ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border/60">
          <p className="text-xs text-muted-foreground">Capturing page…</p>
        </div>
      ) : content ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
            {content}
          </pre>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center">
          <p className="text-xs text-muted-foreground">No preview yet.</p>
        </div>
      )}
    </div>
  );
}
