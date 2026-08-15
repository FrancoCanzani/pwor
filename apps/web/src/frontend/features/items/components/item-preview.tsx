import { Cross2Icon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { isVideoFile, itemHost, itemPreviewUrl } from "@features/items/lib/media";
import { targetNotesQueryOptions } from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import { ArticleNotesMenu } from "@features/reading/article-notes-menu";
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

type LinkView = "content" | "web" | "screenshot";

const LINK_VIEWS: { id: LinkView; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "screenshot", label: "Screenshot" },
  { id: "web", label: "Web" },
];

function isLinkView(value: unknown): value is LinkView {
  return LINK_VIEWS.some((item) => item.id === value);
}

function LinkArticle({
  item,
  html,
  fill,
  view,
  onViewChange,
}: {
  item: Item;
  html: string | null;
  fill?: boolean;
  view: LinkView;
  onViewChange: (view: LinkView) => void;
}) {
  const { openNote } = useFloatingNote();
  const host = itemHost(item.url);
  const hasScreenshot = Boolean(item.hasPreview);
  const tags = item.tags ?? [];
  const title = item.title?.trim() || "Untitled";
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const { data: notes = [] } = useQuery({
    ...targetNotesQueryOptions({ itemId: item.id }),
  });

  const panes: Record<LinkView, ReactNode> = {
    content: html ? (
      <ContentReader
        target={{ itemId: item.id }}
        content={html}
        contained={false}
        showNotesMenu={false}
        focusNoteId={focusNoteId}
        onFocusHandled={() => setFocusNoteId(null)}
      />
    ) : (
      <div className="flex h-48 items-center justify-center">
        <p className="text-xs text-muted-foreground">
          {item.parseStatus === "failed"
            ? "Couldn't extract this page."
            : "Extracting content…"}
        </p>
      </div>
    ),
    screenshot: hasScreenshot ? (
      <img src={itemPreviewUrl(item.id)} alt="" className="w-full" />
    ) : (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No screenshot yet.</p>
      </div>
    ),
    web: item.url ? (
      <iframe
        title={title}
        src={`/api/items/${item.id}/web`}
        className="size-full border-0 bg-background"
        sandbox="allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox allow-modals"
        allow="fullscreen; clipboard-write"
        referrerPolicy="no-referrer"
      />
    ) : (
      <p className="p-4 text-xs text-muted-foreground">No URL</p>
    ),
  };

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-2", fill ? "h-full" : undefined)}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-0.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.url && host ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-blue-600 hover:text-blue-700"
            >
              {host}
            </a>
          ) : null}
          {tags.map((tag) => (
            <span key={tag} className="capitalize">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ToggleGroup
            value={[view]}
            onValueChange={(next) => {
              const value = next[0];
              if (isLinkView(value)) onViewChange(value);
            }}
            variant="outline"
            spacing={0}
            size="sm"
            aria-label="View"
          >
            {LINK_VIEWS.map((option) => (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                className="px-2 text-xs"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ArticleNotesMenu
            notes={notes}
            onSelect={(note) => {
              onViewChange("content");
              setFocusNoteId(note.id);
              openNote(note.id);
            }}
          />
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          view !== "web" && "overflow-y-auto overscroll-contain",
        )}
      >
        {panes[view]}
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
  const [linkView, setLinkView] = useState<LinkView>("content");

  useHotkey("Escape", () => onClose?.(), {
    enabled: Boolean(onClose) && active && variant === "panel",
    conflictBehavior: "replace",
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

  useEffect(() => {
    setLinkView("content");
  }, [item.id]);

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

  const linkContentHtml = isLinkLike
    ? (detail?.contentHtml?.trim() || null)
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

  const body = isLinkLike ? (
    <LinkArticle
      item={displayItem}
      html={linkContentHtml}
      fill={fill}
      view={linkView}
      onViewChange={setLinkView}
    />
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

  const chrome = onClose ? (
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
  ) : null;

  const title = (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <span className="min-w-0 truncate text-sm leading-none font-normal">
        {displayItem.title ?? "Untitled"}
      </span>
      {isLinkLike ? null : <KindBadge item={displayItem} />}
    </div>
  );

  if (variant === "dialog") {
    return (
      <>
        {onClose ? (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            {chrome}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-2 pr-8 text-base leading-none font-normal tracking-tight">
            <span className="min-w-0 truncate">
              {displayItem.title ?? "Untitled"}
            </span>
            {isLinkLike ? null : <KindBadge item={displayItem} />}
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
      <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
        {body}
      </div>
    </div>
  );
}
