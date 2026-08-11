import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  DEFAULT_SPACE_SHADER,
  getSpaceShader,
  type SpaceShaderPreset,
} from "@features/navigation/lib/space-shaders";

const cache = new Map<string, string>();
const CAPTURE_SIZE = 64;
const MAX_CAPTURE_FRAMES = 90;

function cacheKey(shaderId: string) {
  return `${shaderId}:${CAPTURE_SIZE}`;
}

function fallbackGradient(preset: SpaceShaderPreset): string {
  const colors = Array.isArray(preset.props.colors)
    ? (preset.props.colors as string[])
    : null;
  if (colors && colors.length >= 2) {
    return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  }
  const front =
    (typeof preset.props.colorFront === "string" && preset.props.colorFront) ||
    (typeof preset.props.colorBack === "string" && preset.props.colorBack) ||
    "#1a1a1a";
  const back =
    (typeof preset.props.colorBack === "string" && preset.props.colorBack) ||
    "#0a0a0a";
  return `linear-gradient(135deg, ${front}, ${back})`;
}

/**
 * Space pic from a Paper shader preset. Captures at a fixed offscreen WebGL
 * size, then freezes to PNG so the sidebar doesn’t keep a context open per row.
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
  const key = cacheKey(preset.id);
  const [src, setSrc] = useState<string | null>(() => cache.get(key) ?? null);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const { Component, props } = preset;

  useEffect(() => {
    setSrc(cache.get(key) ?? null);
    setFailed(false);
  }, [key]);

  useEffect(() => {
    if (src || failed) return;
    const host = hostRef.current;
    if (!host) return;

    let attempts = 0;
    let raf = 0;
    let cancelled = false;

    const capture = () => {
      if (cancelled) return;
      const canvas = host.querySelector("canvas");
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        if (attempts++ < MAX_CAPTURE_FRAMES) {
          raf = requestAnimationFrame(capture);
        } else {
          setFailed(true);
        }
        return;
      }
      try {
        const url = canvas.toDataURL("image/png");
        if (url === "data:," || url.length < 32) {
          throw new Error("empty capture");
        }
        cache.set(key, url);
        setSrc(url);
      } catch {
        if (attempts++ < MAX_CAPTURE_FRAMES) {
          raf = requestAnimationFrame(capture);
        } else {
          setFailed(true);
        }
      }
    };

    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(capture);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [key, src, failed]);

  return (
    <span
      className={cn(
        sizeClass,
        "relative inline-block shrink-0 overflow-hidden rounded-sm",
        className,
      )}
      aria-hidden
    >
      {!src && !failed ? (
        <div
          ref={hostRef}
          className="pointer-events-none fixed top-0 left-0 -z-10 opacity-0"
          style={{ width: CAPTURE_SIZE, height: CAPTURE_SIZE }}
        >
          <Component
            {...props}
            style={{ width: CAPTURE_SIZE, height: CAPTURE_SIZE }}
          />
        </div>
      ) : null}
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        <span
          className="block size-full bg-muted"
          style={
            failed ? { backgroundImage: fallbackGradient(preset) } : undefined
          }
        />
      )}
    </span>
  );
}
