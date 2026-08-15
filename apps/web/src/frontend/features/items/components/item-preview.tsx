import { Cross2Icon, OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import DOMPurify from "dompurify";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  itemFileTextQueryOptions,
  itemQueryOptions,
  itemSheetQueryOptions,
  type Item,
} from "@features/items/api";
import { KindBadge } from "@features/items/components/kind-badge";
import { PdfViewer } from "@features/items/components/pdf-viewer";
import { SheetViewer } from "@features/items/components/sheet-viewer";
import { isVideoFile, itemPreviewUrl } from "@features/items/lib/media";
import { ContentReader } from "@features/reading/content-reader";
import { isTextPreviewable } from "@features/items/lib/preview";
import { isSheetPreviewable } from "@features/items/lib/sheet";

function TextPreview({
  content,
  downloadUrl,
  fill,
}: {
  content: string | null;
  downloadUrl?: string;
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        fill ? "h-full min-h-0" : "h-[70vh]",
      )}
    >
      <div className="flex shrink-0 justify-end gap-2">
        {downloadUrl ? (
          <Button variant="outline" render={<a href={downloadUrl} download />}>
            Download
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={!content}
          onClick={() => {
            if (!content) return;
            void navigator.clipboard.writeText(content);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {content !== null ? (
          <pre className="whitespace-pre-wrap text-sm text-foreground">
            {content}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export function ItemPreview({
  item,
  active = true,
  variant = "panel",
  onClose,
}: {
  item: Item;
  active?: boolean;
  variant?: "panel" | "dialog";
  onClose?: () => void;
}) {
  const fill = variant === "panel";

  useHotkey("Escape", () => onClose?.(), {
    enabled: Boolean(onClose) && active && variant === "panel",
  });

  const isTextItem = item.kind === "text";
  const isLinkLike = item.kind === "link";
  const fileUrl = `/api/items/${item.id}/file`;
  const isImage = item.mimeType?.startsWith("image/") ?? false;
  const isVideo = isVideoFile(item);
  const isPdf = item.mimeType === "application/pdf";
  const isSheet =
    item.kind === "file" && isSheetPreviewable(item.mimeType, item.title);
  const isTextFile =
    item.kind === "file" &&
    !isSheet &&
    isTextPreviewable(item.mimeType, item.title);

  const { data: detail } = useQuery({
    ...itemQueryOptions(item.id),
    enabled: active && (isTextItem || isLinkLike),
    refetchInterval: (query) =>
      query.state.data?.parseStatus === "pending" ? 2500 : false,
  });

  const { data: fileText } = useQuery({
    ...itemFileTextQueryOptions(item.id),
    enabled: active && isTextFile,
  });

  const { data: workbook, isError: sheetError } = useQuery({
    ...itemSheetQueryOptions(item.id),
    enabled: active && isSheet,
  });

  const textContent = isTextItem
    ? (detail?.content?.trim() || null)
    : (fileText ?? null);

  const rawLinkContentHtml = isLinkLike
    ? (detail?.contentHtml?.trim() || null)
    : null;
  const linkContentHtml = rawLinkContentHtml
    ? DOMPurify.sanitize(rawLinkContentHtml, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["form", "input", "button"],
      })
    : null;

  const displayItem = detail
    ? {
        ...item,
        title: detail.title ?? item.title,
        summary: detail.summary ?? item.summary,
        tags: detail.tags ?? item.tags,
        url: detail.url ?? item.url,
        hasPreview: detail.hasPreview ?? item.hasPreview,
        parseStatus: detail.parseStatus ?? item.parseStatus,
      }
    : item;

  const captureUrl =
    isLinkLike && displayItem.hasPreview ? itemPreviewUrl(item.id) : null;

  const body = isLinkLike ? (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-4 overflow-hidden",
        fill ? "h-full min-h-0" : undefined,
      )}
    >
      <div className="flex shrink-0 flex-col gap-2 px-0.5">
        {displayItem.url ? (
          <a
            href={displayItem.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {displayItem.url}
          </a>
        ) : null}
        {displayItem.summary ? (
          <p className="text-sm text-foreground">{displayItem.summary}</p>
        ) : null}
        {displayItem.tags && displayItem.tags.length > 0 ? (
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {displayItem.tags.map((tag) => (
              <span key={tag} className="capitalize">
                {tag}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      {linkContentHtml ? (
        <ContentReader
          target={{ itemId: item.id }}
          content={linkContentHtml}
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="flex h-48 items-center justify-center">
          <p className="text-xs text-muted-foreground">
            {displayItem.parseStatus === "failed"
              ? "Couldn't extract this page."
              : "Extracting content…"}
          </p>
        </div>
      )}
    </div>
  ) : isTextItem || isTextFile ? (
    <TextPreview
      content={textContent}
      downloadUrl={isTextFile ? fileUrl : undefined}
      fill={fill}
    />
  ) : isSheet ? (
    sheetError ? (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3",
          fill ? "h-full" : "h-[70vh]",
        )}
      >
        <p className="text-sm text-muted-foreground">
          Couldn't preview this sheet.{" "}
          <a href={fileUrl} download className="underline">
            Download it instead
          </a>
          .
        </p>
      </div>
    ) : (
      <div
        className={cn(
          "min-w-0 overflow-hidden",
          fill ? "h-full min-h-0" : "h-[70vh]",
        )}
      >
        <SheetViewer key={item.id} workbook={workbook} downloadUrl={fileUrl} />
      </div>
    )
  ) : isPdf ? (
    <PdfViewer
      key={item.id}
      fileUrl={fileUrl}
      className={fill ? "flex h-full min-h-0 flex-col" : undefined}
    />
  ) : isImage ? (
    <div
      className={cn(
        "flex items-center justify-center overflow-auto",
        fill ? "h-full min-h-0" : "h-[70vh]",
      )}
    >
      <img
        src={fileUrl}
        alt={item.title ?? "Item file"}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  ) : isVideo ? (
    <div
      className={cn(
        "flex items-center justify-center",
        fill ? "h-full min-h-0" : "h-[70vh]",
      )}
    >
      <video
        key={item.id}
        src={fileUrl}
        poster={item.hasPreview ? itemPreviewUrl(item.id) : undefined}
        controls
        playsInline
        className="max-h-full max-w-full"
      />
    </div>
  ) : (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        fill ? "h-full" : "h-[40vh]",
      )}
    >
      <p className="text-sm text-muted-foreground">
        No preview available for this file.{" "}
        <a href={fileUrl} download className="underline">
          Download it instead
        </a>
        .
      </p>
    </div>
  );

  const chrome = (
    <>
      {captureUrl ? (
        <TooltipIconButton
          label="Page capture"
          className="text-muted-foreground"
          onClick={() =>
            window.open(captureUrl, "_blank", "noopener,noreferrer")
          }
        >
          <OpenInNewWindowIcon />
        </TooltipIconButton>
      ) : null}
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close"
          className={variant === "panel" ? "hidden md:inline-flex" : undefined}
          onClick={onClose}
        >
          <Cross2Icon />
        </Button>
      ) : null}
    </>
  );

  const title = (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <span className="min-w-0 truncate text-sm leading-none font-normal">
        {displayItem.title ?? "Untitled"}
      </span>
      <KindBadge item={displayItem} />
    </div>
  );

  if (variant === "dialog") {
    return (
      <>
        {captureUrl || onClose ? (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            {chrome}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-2 pr-8 text-base leading-none font-normal tracking-tight">
            <span className="min-w-0 truncate">
              {displayItem.title ?? "Untitled"}
            </span>
            <KindBadge item={displayItem} />
          </h2>
        </div>
        {body}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="font-normal md:hidden"
            onClick={onClose}
          >
            Back
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">{title}</div>
        {chrome}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">{body}</div>
    </div>
  );
}
