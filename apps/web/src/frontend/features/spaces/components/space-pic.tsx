import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  DEFAULT_SPACE_SHADER,
  getSpaceShader,
  type SpaceShaderPreset,
} from "@features/spaces/lib/space-shaders";

const cache = new Map<string, string>();
const CAPTURE_SIZE = 64;
const MAX_CAPTURE_FRAMES = 180;

const waiters: Array<() => void> = [];
let capturing = false;

function acquireCapture(): Promise<void> {
  if (!capturing) {
    capturing = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      capturing = true;
      resolve();
    });
  });
}

function releaseCapture() {
  const next = waiters.shift();
  if (next) next();
  else capturing = false;
}

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
    (typeof preset.props.colorInner === "string" && preset.props.colorInner) ||
    "#1a1a1a";
  const back =
    (typeof preset.props.colorBack === "string" && preset.props.colorBack) ||
    "#0a0a0a";
  return `linear-gradient(135deg, ${front}, ${back})`;
}

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
    size === "lg" ? "size-16" : size === "md" ? "size-5" : "size-4";
  const key = cacheKey(preset.id);
  const [src, setSrc] = useState<string | null>(() => cache.get(key) ?? null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const { Component, props } = preset;
  const fallback = fallbackGradient(preset);

  useEffect(() => {
    setSrc(cache.get(key) ?? null);
    setLive(false);
    setFailed(false);
  }, [key]);

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setSrc(cached);
      return;
    }
    if (src || failed) return;

    let cancelled = false;
    let held = false;

    void acquireCapture().then(() => {
      if (cancelled) {
        releaseCapture();
        return;
      }
      held = true;
      setLive(true);
    });

    return () => {
      cancelled = true;
      if (held) releaseCapture();
    };
  }, [key, src, failed]);

  useEffect(() => {
    if (!live || src || failed) return;
    const host = hostRef.current;
    if (!host) return;

    let attempts = 0;
    let raf = 0;
    let cancelled = false;

    const finish = (next: string | null) => {
      if (cancelled) return;
      if (next) {
        cache.set(key, next);
        setSrc(next);
      } else {
        setFailed(true);
      }
      setLive(false);
    };

    const capture = () => {
      if (cancelled) return;
      const canvas = host.querySelector("canvas");
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        if (attempts++ < MAX_CAPTURE_FRAMES) {
          raf = requestAnimationFrame(capture);
        } else {
          finish(null);
        }
        return;
      }
      try {
        const url = canvas.toDataURL("image/png");
        if (url === "data:," || url.length < 32) {
          throw new Error("empty capture");
        }
        finish(url);
      } catch {
        if (attempts++ < MAX_CAPTURE_FRAMES) {
          raf = requestAnimationFrame(capture);
        } else {
          finish(null);
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
  }, [key, live, src, failed]);

  return (
    <span
      className={cn(
        sizeClass,
        "relative inline-block shrink-0 overflow-hidden rounded-sm",
        className,
      )}
      style={src ? undefined : { backgroundImage: fallback }}
      aria-hidden
    >
      {live ? (
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
          className="size-full object-cover object-left"
        />
      ) : null}
    </span>
  );
}
