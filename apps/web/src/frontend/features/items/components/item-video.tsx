import { useEffect, useRef, type PointerEvent } from "react";

import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";
import {
  canHoverPlay,
  claimPlayback,
  itemFileUrl,
  itemPreviewUrl,
  releasePlayback,
} from "@features/items/lib/media";

export function ItemVideo({
  item,
  play,
  className,
}: {
  item: Item;
  play: "hover" | "mount";
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (play !== "mount") return;
    const el = ref.current;
    if (!el || !canHoverPlay()) return;
    claimPlayback(el);
    void el.play().catch(() => {});
    return () => releasePlayback(el);
  }, [play]);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el || !canHoverPlay()) return;
    claimPlayback(el);
    void el.play().catch(() => {});
  }

  function stop(event: PointerEvent<HTMLDivElement>) {
    const media = event.currentTarget.parentElement;
    if (media?.contains(event.relatedTarget as Node | null)) return;
    ref.current?.pause();
  }

  const video = (
    <video
      ref={ref}
      src={itemFileUrl(item.id)}
      poster={item.hasPreview ? itemPreviewUrl(item.id) : undefined}
      muted
      loop
      playsInline
      preload="none"
      draggable={false}
      className={cn(
        "object-cover",
        play === "hover"
          ? "pointer-events-none size-full"
          : "block aspect-video w-full",
        className,
      )}
    />
  );

  if (play === "mount") return video;

  return (
    <div
      className="size-full"
      onPointerEnter={start}
      onPointerLeave={stop}
    >
      {video}
    </div>
  );
}
