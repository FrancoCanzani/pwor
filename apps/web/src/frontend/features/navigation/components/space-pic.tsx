import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  DEFAULT_SPACE_SHADER,
  getSpaceShader,
} from "@features/navigation/lib/space-shaders";

const cache = new Map<string, string>();

function cacheKey(shaderId: string, size: string) {
  return `${shaderId}:${size}`;
}

/**
 * Space pic from a Paper shader preset. Renders once via WebGL, then freezes
 * to a PNG so the sidebar doesn’t keep a context open per row.
 */
export function SpacePic({
  shaderId = DEFAULT_SPACE_SHADER,
  className,
  size = "sm",
}: {
  shaderId?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const preset = getSpaceShader(shaderId);
  const sizeClass =
    size === "lg" ? "size-16" : size === "md" ? "size-10" : "size-4";
  const key = cacheKey(preset.id, size);
  const [src, setSrc] = useState<string | null>(() => cache.get(key) ?? null);
  const hostRef = useRef<HTMLDivElement>(null);
  const { Component, props } = preset;

  useEffect(() => {
    setSrc(cache.get(key) ?? null);
  }, [key]);

  useEffect(() => {
    if (src) return;
    const host = hostRef.current;
    if (!host) return;

    let attempts = 0;
    let raf = 0;

    const capture = () => {
      const canvas = host.querySelector("canvas");
      if (!canvas || canvas.width === 0) {
        if (attempts++ < 12) {
          raf = requestAnimationFrame(capture);
        }
        return;
      }
      try {
        const url = canvas.toDataURL("image/png");
        cache.set(key, url);
        setSrc(url);
      } catch {
        // leave live shader mounted
      }
    };

    raf = requestAnimationFrame(capture);
    return () => cancelAnimationFrame(raf);
  }, [key, src]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          sizeClass,
          "shrink-0 rounded-sm object-cover",
          className,
        )}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className={cn(
        sizeClass,
        "shrink-0 overflow-hidden rounded-sm bg-muted",
        className,
      )}
      aria-hidden
    >
      <Component {...props} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
