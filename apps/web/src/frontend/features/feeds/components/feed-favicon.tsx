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
  className,
}: {
  siteUrl: string | null;
  className?: string;
}) {
  const host = hostFromUrl(siteUrl);
  const [failed, setFailed] = useState(false);

  if (!host || failed) {
    return (
      <GlobeIcon className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      draggable={false}
      className={cn("size-3.5 shrink-0 rounded-xs", className)}
      onError={() => setFailed(true)}
    />
  );
}
