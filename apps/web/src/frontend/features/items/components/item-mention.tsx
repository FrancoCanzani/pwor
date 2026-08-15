import { useState, type ReactNode } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";
import { ItemVideo } from "@features/items/components/item-video";
import { PdfThumb } from "@features/items/components/pdf-thumb";
import {
  isPdfFile,
  isVideoFile,
  itemFileUrl,
  itemHost,
  itemStillUrl,
} from "@features/items/lib/media";

export function SiteFavicon({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const host = itemHost(url);
  const [failed, setFailed] = useState(false);
  if (!host || failed) return null;

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      draggable={false}
      className={cn("size-4 shrink-0 rounded-sm", className)}
      onError={() => setFailed(true)}
    />
  );
}

export function Mention({
  title,
  label,
  siteUrl,
  className,
  titleClassName,
}: {
  title: string;
  label?: string | null;
  siteUrl?: string | null;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm", className)}
    >
      {siteUrl ? <SiteFavicon url={siteUrl} /> : null}
      {label ? (
        <span className="max-w-[7rem] shrink-0 truncate text-muted-foreground">
          {label}
        </span>
      ) : null}
      <span
        className={cn(
          "min-w-0 truncate underline decoration-foreground/40 underline-offset-2",
          titleClassName,
        )}
      >
        {title}
      </span>
    </span>
  );
}

export function ItemMention({
  item,
  className,
}: {
  item: Item;
  className?: string;
}) {
  const title = item.title?.trim() || "Untitled";
  const siteUrl = item.kind === "link" ? item.url : null;
  const label =
    item.kind === "link"
      ? item.siteName?.trim() || itemHost(item.url)
      : null;

  return (
    <Mention
      title={title}
      label={label}
      siteUrl={siteUrl}
      className={className}
    />
  );
}

export function HoverPreview({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!content) return children;

  return (
    <HoverCard onOpenChange={setOpen}>
      <HoverCardTrigger
        render={
          <span className="inline-flex min-w-0 flex-1 items-center" />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent>{open ? content : null}</HoverCardContent>
    </HoverCard>
  );
}

function itemHoverContent(item: Item): ReactNode {
  const title = item.title?.trim() || "Untitled";
  const summary = item.summary?.trim() || null;
  const still = itemStillUrl(item);
  const host = item.kind === "link" ? itemHost(item.url) : null;
  const video = isVideoFile(item);
  const pdf = isPdfFile(item);

  return (
    <div className="flex flex-col">
      {video ? (
        <ItemVideo item={item} play="mount" />
      ) : pdf ? (
        <div className="aspect-[4/3] w-full overflow-hidden">
          <PdfThumb fileUrl={itemFileUrl(item.id)} />
        </div>
      ) : still ? (
        <img
          src={still}
          alt=""
          className={cn(
            "aspect-[4/3] w-full object-cover",
            item.kind === "link" && "object-top",
          )}
        />
      ) : null}
      <div className="flex flex-col gap-1 px-3 py-2.5">
        <p className="line-clamp-2 text-sm font-bold">{title}</p>
        {summary ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {summary}
          </p>
        ) : null}
        {item.kind === "link" && host ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {item.url ? (
              <SiteFavicon url={item.url} className="size-3.5" />
            ) : null}
            <span className="truncate text-xs text-muted-foreground">
              {host}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ItemHoverCard({
  item,
  children,
}: {
  item: Item;
  children: ReactNode;
}) {
  return (
    <HoverPreview content={itemHoverContent(item)}>{children}</HoverPreview>
  );
}
