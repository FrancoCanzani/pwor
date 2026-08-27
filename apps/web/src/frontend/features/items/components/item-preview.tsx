import { Cross2Icon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { LayoutSidebarTrigger } from "@/components/layout/layout-sidebar-trigger";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  itemFileTextQueryOptions,
  itemQueryOptions,
  itemSheetQueryOptions,
  type Item,
  type ItemDetail,
} from "@features/items/api";
import { PdfViewer } from "@features/items/components/pdf-viewer";
import { SheetViewer } from "@features/items/components/sheet-viewer";
import { TweetEmbed } from "@features/items/components/tweet-embed";
import { isVideoFile, itemHost, itemPreviewUrl } from "@features/items/lib/media";
import { itemTitle } from "@features/items/lib/list";
import { isTextPreviewable } from "@features/items/lib/preview";
import { isSheetPreviewable } from "@features/items/lib/sheet";
import { targetNotesQueryOptions } from "@features/notes/api";
import { useFloatingNote } from "@features/notes/floating-note-context";
import { ArticleNotesMenu } from "@features/reading/article-notes-menu";
import { ContentReader } from "@features/reading/content-reader";
import { TWEET_HOSTS, tweetIdFromUrl } from "@shared/tweet";

function TextPreview({
  content,
  downloadUrl,
}: {
  content: string | null;
  downloadUrl?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
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

function isSourceTag(
  tag: string,
  host: string | null,
  siteName: string | null,
): boolean {
  const t = tag.trim().toLowerCase();
  if (!t) return true;
  if (siteName && t === siteName.trim().toLowerCase()) return true;
  if (!host) return false;
  const h = host.toLowerCase();
  if (t === h) return true;
  if (t === h.split(".")[0]) return true;
  return TWEET_HOSTS.has(h) && (t === "twitter" || t === "bookmark");
}

function overlayDetail(item: Item, detail: ItemDetail): Item {
  const next = {
    title: detail.title ?? item.title,
    summary: detail.summary ?? item.summary,
    tags: detail.tags ?? item.tags,
    parseStatus: detail.parseStatus ?? item.parseStatus,
  };
  switch (item.kind) {
    case "link":
      return {
        ...item,
        ...next,
        url: (detail.kind === "link" ? detail.url : item.url) || item.url,
        hasPreview: detail.hasPreview,
      };
    case "file":
      return {
        ...item,
        ...next,
        hasPreview: detail.hasPreview,
      };
    case "text":
      return { ...item, ...next };
    default: {
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

function LinkArticle({
  item,
  html,
  view,
  onViewChange,
}: {
  item: Item;
  html: string | null;
  view: LinkView;
  onViewChange: (view: LinkView) => void;
}) {
  const { openNote } = useFloatingNote();
  const host = itemHost(item.url);
  const tweetId = tweetIdFromUrl(item.url ?? "");
  const hasScreenshot = Boolean(item.hasPreview);
  const tags = (item.tags ?? []).filter(
    (tag) => !isSourceTag(tag, host, item.siteName),
  );
  const title = item.title?.trim() || "Untitled";
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const { data: notes = [] } = useQuery({
    ...targetNotesQueryOptions({ itemId: item.id }),
  });

  const panes: Record<LinkView, ReactNode> = {
    content: tweetId ? (
      <TweetEmbed id={tweetId} />
    ) : html ? (
      <ContentReader
        target={{ itemId: item.id }}
        content={html}
        contained={false}
        showNotesMenu={false}
        focusNoteId={focusNoteId}
        onFocusHandled={() => setFocusNoteId(null)}
      />
    ) : (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">
          {item.parseStatus === "pending"
            ? "Extracting content…"
            : "Couldn't extract this page."}
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-4">
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
          "min-h-0 flex-1 px-4 pt-3 pb-3",
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
  onClose,
}: {
  item: Item;
  active?: boolean;
  onClose?: () => void;
}) {
  const [linkView, setLinkView] = useState<LinkView>("content");

  useHotkey("Escape", () => onClose?.(), {
    enabled: Boolean(onClose) && active,
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

  const displayItem = detail ? overlayDetail(item, detail) : item;

  const body = isLinkLike ? (
    <LinkArticle
      item={displayItem}
      html={linkContentHtml}
      view={linkView}
      onViewChange={setLinkView}
    />
  ) : isTextItem || isTextFile ? (
    <TextPreview
      content={textContent}
      downloadUrl={isTextFile ? fileUrl : undefined}
    />
  ) : isSheet ? (
    sheetError ? (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          Couldn't preview this sheet.{" "}
          <a href={fileUrl} download className="underline">
            Download it instead
          </a>
          .
        </p>
      </div>
    ) : (
      <div className="h-full min-h-0 min-w-0 overflow-hidden">
        <SheetViewer key={item.id} workbook={workbook} downloadUrl={fileUrl} />
      </div>
    )
  ) : isPdf ? (
    <PdfViewer
      key={item.id}
      fileUrl={fileUrl}
      className="flex h-full min-h-0 flex-col"
    />
  ) : isImage ? (
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto">
      <img
        src={fileUrl}
        alt={item.title ?? "Item file"}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  ) : isVideo ? (
    <div className="flex h-full min-h-0 items-center justify-center">
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
    <div className="flex h-full flex-col items-center justify-center">
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
      className="hidden md:inline-flex"
      onClick={onClose}
    >
      <Cross2Icon />
    </Button>
  ) : null;

  const title = (
    <span className="min-w-0 truncate text-sm leading-none font-normal">
      {itemTitle(displayItem)}
    </span>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        {onClose ? (
          <LayoutSidebarTrigger className="size-4 shrink-0 p-0 [&_svg]:size-3" />
        ) : null}
        <div className="min-w-0 flex-1">{title}</div>
        {chrome}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          !isLinkLike && "px-4 pt-3 pb-3",
        )}
      >
        {body}
      </div>
    </div>
  );
}
