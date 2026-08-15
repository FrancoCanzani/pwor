import { useState } from "react";
import { GlobeIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";

function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function FeedFavicon({
  siteUrl,
  imageUrl,
  className,
}: {
  siteUrl: string | null;
  imageUrl?: string | null;
  className?: string;
}) {
  const host = hostFromUrl(siteUrl);
  const [failedImage, setFailedImage] = useState(false);
  const [failedFavicon, setFailedFavicon] = useState(false);
  const custom = imageUrl && !failedImage ? imageUrl : null;
  const favicon =
    !custom && host && !failedFavicon
      ? `https://www.google.com/s2/favicons?domain=${host}&sz=32`
      : null;

  if (custom) {
    return (
      <img
        src={custom}
        alt=""
        draggable={false}
        referrerPolicy="no-referrer"
        className={cn(
          "size-3.5 shrink-0 rounded-xs object-cover",
          className,
        )}
        onError={() => setFailedImage(true)}
      />
    );
  }

  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        draggable={false}
        className={cn("size-3.5 shrink-0 rounded-xs object-cover", className)}
        onError={() => setFailedFavicon(true)}
      />
    );
  }

  return (
    <GlobeIcon
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
    />
  );
}
