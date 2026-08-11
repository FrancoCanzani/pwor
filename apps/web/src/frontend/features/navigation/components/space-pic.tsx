import { StaticMeshGradient } from "@paper-design/shaders-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  spacePicColors,
  spacePicPositions,
  spacePicRotation,
} from "@features/navigation/lib/space-pic";

const cache = new Map<string, string>();

/**
 * Unique cosmic “space pic” per space id, via Paper StaticMeshGradient.
 * Renders once through WebGL, then freezes to a PNG so we don’t keep a
 * context open for every row in the sidebar.
 */
export function SpacePic({
  spaceId,
  className,
}: {
  spaceId: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(() => cache.get(spaceId) ?? null);
  const hostRef = useRef<HTMLDivElement>(null);

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
        cache.set(spaceId, url);
        setSrc(url);
      } catch {
        // WebGL/tainted canvas — leave the live shader mounted.
      }
    };

    raf = requestAnimationFrame(capture);
    return () => cancelAnimationFrame(raf);
  }, [spaceId, src]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          "size-4 shrink-0 rounded-sm object-cover",
          className,
        )}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className={cn(
        "size-4 shrink-0 overflow-hidden rounded-sm bg-muted",
        className,
      )}
      aria-hidden
    >
      <StaticMeshGradient
        colors={spacePicColors(spaceId)}
        positions={spacePicPositions(spaceId)}
        rotation={spacePicRotation(spaceId)}
        waveX={0.7}
        waveXShift={0.4}
        waveY={0.85}
        waveYShift={0.3}
        mixing={0.7}
        grainMixer={0.15}
        grainOverlay={0.08}
        speed={0}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
