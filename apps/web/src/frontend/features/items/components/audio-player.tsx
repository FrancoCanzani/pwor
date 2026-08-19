import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatRate,
  nextPlaybackRate,
  SKIP_S,
} from "@features/items/lib/audio";

function halt(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function waveColors(el: HTMLElement) {
  const styles = getComputedStyle(el);
  return {
    progressColor: styles.getPropertyValue("--foreground").trim() || "#111111",
    cursorColor: styles.getPropertyValue("--foreground").trim() || "#111111",
    waveColor:
      styles.getPropertyValue("--muted-foreground").trim() || "#737373",
  };
}

export function AudioPlayer({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLSpanElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        io.disconnect();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const container = waveRef.current;
    if (!visible || !container) return;

    const ws = WaveSurfer.create({
      container,
      url: src,
      height: 32,
      barWidth: 2,
      barGap: 1.5,
      barRadius: 1,
      barMinHeight: 1,
      cursorWidth: 1,
      normalize: true,
      dragToSeek: true,
      hideScrollbar: true,
      ...waveColors(container),
    });
    wsRef.current = ws;

    const writeTime = (seconds: number) => {
      if (currentRef.current) {
        currentRef.current.textContent = formatDuration(seconds);
      }
    };

    ws.on("ready", (next) => {
      setDuration(next);
      ws.setPlaybackRate(rateRef.current);
      writeTime(ws.getCurrentTime());
    });
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("timeupdate", writeTime);
    ws.on("seeking", writeTime);

    return () => {
      wsRef.current = null;
      ws.destroy();
      setPlaying(false);
      setDuration(0);
      setRate(1);
      writeTime(0);
    };
  }, [src, visible]);

  useEffect(() => {
    wsRef.current?.setPlaybackRate(rate);
  }, [rate]);

  function toggle() {
    void wsRef.current?.playPause();
  }

  return (
    <div
      ref={rootRef}
      data-no-drag
      tabIndex={0}
      className={cn("flex min-w-0 flex-col gap-1 outline-none", className)}
      onClick={halt}
      onPointerDown={halt}
      onKeyDown={(event) => {
        if (event.key === " ") {
          event.preventDefault();
          toggle();
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          wsRef.current?.skip(-SKIP_S);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          wsRef.current?.skip(SKIP_S);
        }
      }}
    >
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Skip back ${SKIP_S} seconds`}
          className="text-muted-foreground"
          onClick={() => wsRef.current?.skip(-SKIP_S)}
        >
          <SkipBack />
        </Button>
        <Button
          type="button"
          variant="default"
          size="icon-xs"
          aria-label={playing ? "Pause" : "Play"}
          onClick={toggle}
        >
          {playing ? (
            <Pause className="fill-current" />
          ) : (
            <Play className="fill-current" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Skip forward ${SKIP_S} seconds`}
          className="text-muted-foreground"
          onClick={() => wsRef.current?.skip(SKIP_S)}
        >
          <SkipForward />
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`Playback speed ${formatRate(rate)}`}
          className="px-1.5 font-nums text-[10px] text-muted-foreground"
          onClick={() => setRate((current) => nextPlaybackRate(current))}
        >
          {formatRate(rate)}
        </Button>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span
          ref={currentRef}
          className="w-8 shrink-0 text-right font-nums text-[10px] text-muted-foreground"
        >
          0:00
        </span>
        <div ref={waveRef} className="h-8 min-w-8 flex-1 overflow-hidden" />
        <span className="w-8 shrink-0 font-nums text-[10px] text-muted-foreground">
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
