import { DrawingPinFilledIcon } from "@radix-ui/react-icons";
import { useRef, useState, type DragEvent, type ReactNode } from "react";

import { FileTypeIcon } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenuTrigger } from "@/components/ui/context-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { noteDisplayTitle } from "@shared/note-frontmatter";
import type { Item } from "@features/items/api";
import type { LibraryEntry } from "@features/items/components/library-entry";
import { LibraryItemMenus } from "@features/items/components/library-item-menus";
import type { LibraryItemHandlers } from "@features/items/components/library-row";
import { ItemGlyph, SiteFavicon } from "@features/items/components/item-mention";
import { ItemVideo } from "@features/items/components/item-video";
import { PdfThumb } from "@features/items/components/pdf-thumb";
import { TweetEmbed } from "@features/items/components/tweet-embed";
import {
  formatItemDateShort,
  itemTitle,
} from "@features/items/lib/list";
import {
  isPdfFile,
  isVideoFile,
  itemAwaitingScreenshot,
  itemFileUrl,
  itemHost,
  itemOpenHref,
  itemStillUrl,
  itemTweetId,
} from "@features/items/lib/media";
import type { NoteListItem } from "@features/notes/api";
import { NoteMenus } from "@features/notes/components/note-row";
import { NotePreview } from "@features/notes/components/note-preview";

type WellKind = "video" | "pdf" | "still" | "clipping" | "glyph" | "tweet";

export function LibraryCard({
  entry,
  variant,
  selecting,
  deleteDescription,
  selected,
  dragging,
  active,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  entry: LibraryEntry;
  variant: "grid" | "masonry";
  selecting: boolean;
  deleteDescription: string;
} & LibraryItemHandlers) {
  switch (entry.kind) {
    case "item":
      return (
        <ItemCard
          item={entry.item}
          variant={variant}
          selecting={selecting}
          deleteDescription={deleteDescription}
          selected={selected}
          dragging={dragging}
          active={active}
          onOpen={onOpen}
          onToggle={onToggle}
          onPin={onPin}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      );
    case "note":
      return (
        <NoteCard
          note={entry.note}
          variant={variant}
          selecting={selecting}
          deleteDescription={deleteDescription}
          selected={selected}
          dragging={dragging}
          active={active}
          onOpen={onOpen}
          onToggle={onToggle}
          onPin={onPin}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      );
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}

function ItemCard({
  item,
  variant,
  selecting,
  deleteDescription,
  selected,
  dragging,
  active,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  item: Item;
  variant: "grid" | "masonry";
  selecting: boolean;
  deleteDescription: string;
} & LibraryItemHandlers) {
  const title = itemTitle(item);
  const kind = itemWellKind(item);
  const site =
    item.kind === "link"
      ? item.siteName?.trim() || itemHost(item.url)
      : null;

  return (
    <LibraryItemMenus
      title={title}
      deleteDescription={deleteDescription}
      pinned={item.pinned}
      externalHref={itemOpenHref(item)}
      downloadHref={item.kind !== "link" ? itemFileUrl(item.id) : null}
      onOpen={onOpen}
      onToggle={onToggle}
      onPin={onPin}
      onDelete={onDelete}
    >
      <CardTrigger
        variant={variant}
        selected={selected}
        dragging={dragging}
        onOpen={onOpen}
        onToggle={onToggle}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={title}
        selecting={selecting}
        pinned={item.pinned}
        active={active}
        well={
          <ItemWell item={item} kind={kind} variant={variant} />
        }
        glyph={<ItemGlyph item={item} className="size-3.5" />}
        site={site}
        date={formatItemDateShort(item.createdAt)}
      />
    </LibraryItemMenus>
  );
}

function NoteCard({
  note,
  variant,
  selecting,
  deleteDescription,
  selected,
  dragging,
  active,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  note: NoteListItem;
  variant: "grid" | "masonry";
  selecting: boolean;
  deleteDescription: string;
} & LibraryItemHandlers) {
  const title = noteDisplayTitle(note.title);
  const body = note.body?.trim() || "";

  return (
    <NoteMenus
      title={title}
      pinned={Boolean(note.pinned)}
      deleteDescription={deleteDescription}
      onOpen={onOpen}
      onToggle={onToggle}
      onPin={onPin}
      onDelete={onDelete}
    >
      <CardTrigger
        variant={variant}
        selected={selected}
        dragging={dragging}
        onOpen={onOpen}
        onToggle={onToggle}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={title}
        selecting={selecting}
        pinned={Boolean(note.pinned)}
        active={active}
        well={
          <Well kind="clipping" variant={variant} className="bg-background">
            <div className="size-full overflow-hidden px-2.5 py-2">
              <NotePreview body={body} />
            </div>
          </Well>
        }
        date={formatItemDateShort(note.updatedAt)}
      />
    </NoteMenus>
  );
}

function CardTrigger({
  variant,
  selected,
  dragging,
  onOpen,
  onToggle,
  onDragStart,
  onDragEnd,
  title,
  selecting,
  pinned,
  well,
  glyph,
  site,
  date,
  active,
}: {
  variant: "grid" | "masonry";
  selected: boolean;
  dragging: boolean;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  title: string;
  selecting: boolean;
  pinned: boolean;
  well: ReactNode;
  glyph?: ReactNode;
  site?: string | null;
  date: string;
  active: boolean;
}) {
  const didDrag = useRef(false);

  return (
    <ContextMenuTrigger
      render={
        <li
          draggable
          onDragStart={(event) => {
            if ((event.target as HTMLElement).closest("[data-no-drag]")) {
              event.preventDefault();
              return;
            }
            didDrag.current = true;
            onDragStart(event);
          }}
          onDragEnd={onDragEnd}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("[data-no-drag]")) {
              return;
            }
            if (didDrag.current) {
              didDrag.current = false;
              return;
            }
            onOpen();
          }}
          className={cn(
            "group flex min-w-0 cursor-grab flex-col overflow-hidden rounded-2xl border border-border bg-background select-none active:cursor-grabbing",
            variant === "grid" &&
              "[content-visibility:auto] [contain-intrinsic-size:auto_280px]",
            dragging && "opacity-40",
            (active || selected) && "border-foreground/25",
          )}
        />
      }
    >
      <div className="relative">
        {well}
        <span
          data-no-drag
          className={cn(
            "absolute top-1.5 left-1.5 z-10 opacity-0 transition-opacity duration-100 group-hover:opacity-100",
            (selected || selecting) && "opacity-100",
          )}
        >
          <Checkbox
            checked={selected}
            aria-label={`Select ${title}`}
            className="border-border bg-background after:hidden"
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
        </span>
        {pinned ? (
          <span className="absolute top-1.5 right-1.5 z-10 flex size-5 items-center justify-center rounded-sm bg-background/80">
            <DrawingPinFilledIcon className="size-3 text-muted-foreground" />
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-1 px-2 py-2 text-[11px] text-muted-foreground">
        {glyph}
        {site ? (
          <span className="max-w-[7rem] shrink-0 truncate">{site}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-foreground">{title}</span>
        <span className="shrink-0 font-nums">{date}</span>
      </div>
    </ContextMenuTrigger>
  );
}

function ItemWell({
  item,
  kind,
  variant,
}: {
  item: Item;
  kind: WellKind;
  variant: "grid" | "masonry";
}) {
  const still = itemStillUrl(item);
  const cover = kind === "still" && (variant === "grid" || item.kind === "link");

  return (
    <Well kind={kind} variant={variant} itemKind={item.kind}>
      <ItemWellBody item={item} kind={kind} still={still} cover={cover} />
    </Well>
  );
}

function ItemWellBody({
  item,
  kind,
  still,
  cover,
}: {
  item: Item;
  kind: WellKind;
  still: string | null;
  cover: boolean;
}) {
  switch (kind) {
    case "video":
      return <ItemVideo item={item} play="hover" className="size-full object-cover" />;
    case "pdf":
      return <PdfThumb fileUrl={itemFileUrl(item.id)} />;
    case "still":
      return still ? (
        <Still key={still} src={still} cover={cover} cropTop={item.kind === "link"} />
      ) : (
        <CardSpinner />
      );
    case "tweet": {
      const tweetId = itemTweetId(item);
      return tweetId ? (
        <div className="pointer-events-none size-full overflow-hidden p-2.5">
          <TweetEmbed id={tweetId} compact />
        </div>
      ) : null;
    }
    case "clipping":
      return <Clipping text={itemClippingText(item)} />;
    case "glyph":
      return (
        <GlyphField>
          {item.kind === "link" && item.url ? (
            <SiteFavicon url={item.url} className="size-8" />
          ) : (
            <FileTypeIcon item={item} className="size-8" />
          )}
        </GlyphField>
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function Well({
  kind,
  variant,
  itemKind,
  className,
  children,
}: {
  kind: WellKind;
  variant: "grid" | "masonry";
  itemKind?: Item["kind"];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="well"
      className={cn(
        "relative overflow-hidden",
        wellFill(kind),
        wellShape(variant, kind, itemKind),
        className,
      )}
    >
      {children}
    </div>
  );
}

function wellFill(kind: WellKind): string {
  switch (kind) {
    case "tweet":
    case "clipping":
      return "bg-background";
    case "still":
    case "video":
    case "pdf":
    case "glyph":
      return "bg-muted";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function wellShape(
  variant: "grid" | "masonry",
  kind: WellKind,
  itemKind?: Item["kind"],
): string {
  if (variant === "grid") return "aspect-[4/3]";
  switch (kind) {
    case "still":
      return itemKind === "link" ? "aspect-[16/10]" : "";
    case "video":
      return "aspect-video";
    case "pdf":
      return "aspect-[3/4]";
    case "tweet":
      return "max-h-72";
    case "clipping":
    case "glyph":
      return "aspect-[4/3]";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function CardSpinner() {
  return (
    <Spinner
      label={null}
      size="sm"
      className="pointer-events-none absolute top-1.5 right-1.5 z-10 text-foreground/50 [&>span]:size-3.5"
    />
  );
}

function Still({
  src,
  cover,
  cropTop,
}: {
  src: string;
  cover: boolean;
  cropTop: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          cover ? "size-full object-cover" : "h-auto w-full",
          cropTop && "object-top",
          !loaded && "opacity-0",
        )}
      />
      {loaded ? null : <CardSpinner />}
    </>
  );
}

function Clipping({ text }: { text: string }) {
  return (
    <div className="flex size-full items-center justify-center overflow-hidden px-3 py-4">
      <p className="line-clamp-8 text-center text-xs leading-relaxed text-foreground/80">
        {text}
      </p>
    </div>
  );
}

function GlyphField({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-full items-center justify-center text-muted-foreground">
      {children}
    </div>
  );
}

function itemWellKind(item: Item): WellKind {
  if (itemTweetId(item)) return "tweet";
  if (isVideoFile(item)) return "video";
  if (isPdfFile(item)) return "pdf";
  if (itemStillUrl(item) || itemAwaitingScreenshot(item)) return "still";
  if (item.kind === "text" && itemClippingText(item)) return "clipping";
  if (item.kind === "link" && item.summary?.trim()) return "clipping";
  return "glyph";
}

function itemClippingText(item: Item): string {
  return item.summary?.trim() || item.title?.trim() || "";
}
