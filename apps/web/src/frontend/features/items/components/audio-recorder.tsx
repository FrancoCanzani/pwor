import { Mic, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipIconButton,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  MAX_RECORD_MS,
  MIN_RECORD_MS,
  pickRecorderMime,
  recorderExtension,
} from "@features/items/lib/audio";

const BAR_W = 2;
const BAR_GAP = 1.5;
const SAMPLE_MS = 50;

type Session = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  startedAt: number;
  pauseMs: number;
  pausedAt: number | null;
  mime: string;
  frame: number;
};

function sessionElapsed(session: Session): number {
  const end = session.pausedAt ?? Date.now();
  return end - session.startedAt - session.pauseMs;
}

function LiveWave({
  stream,
  paused,
  className,
}: {
  stream: MediaStream | null;
  paused: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    peaksRef.current = [];
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const node = canvas;
    const gfx = ctx;
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastSample = 0;

    function size() {
      const dpr = window.devicePixelRatio || 1;
      const rect = node.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      node.width = Math.max(1, Math.floor(width * dpr));
      node.height = Math.max(1, Math.floor(height * dpr));
      gfx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      gfx.clearRect(0, 0, width, height);
      gfx.fillStyle = getComputedStyle(node).color;
      const pitch = BAR_W + BAR_GAP;
      const maxBars = Math.max(1, Math.floor(width / pitch));
      const peaks = peaksRef.current;
      if (peaks.length > maxBars) peaks.splice(0, peaks.length - maxBars);
      const startX = 0;
      for (let i = 0; i < peaks.length; i++) {
        const barH = Math.max(2, (peaks[i] ?? 0) * height * 0.9);
        const x = startX + i * pitch;
        const y = (height - barH) / 2;
        gfx.beginPath();
        gfx.roundRect(x, y, BAR_W, barH, 1);
        gfx.fill();
      }
    }

    size();
    draw();

    const ro = new ResizeObserver(() => {
      size();
      draw();
    });
    ro.observe(node);

    if (!stream) {
      return () => ro.disconnect();
    }

    const audioCtx = new AudioContext();
    // Safari starts AudioContext suspended until a user gesture.
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.35;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    function tick(now: number) {
      if (!pausedRef.current) {
        analyser.getByteTimeDomainData(samples);
        if (now - lastSample >= SAMPLE_MS) {
          lastSample = now;
          let sum = 0;
          for (let i = 0; i < samples.length; i++) {
            const v = ((samples[i] ?? 128) - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / samples.length);
          peaksRef.current.push(Math.min(1, Math.max(0.08, rms * 3.6)));
        }
      }
      draw();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      source.disconnect();
      void audioCtx.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-7 min-w-0 flex-1 text-muted-foreground", className)}
    />
  );
}

export function useAudioRecorder({
  disabled,
  onRecorded,
}: {
  disabled?: boolean;
  onRecorded: (file: File) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  function paint(elapsedMs: number) {
    if (elapsedRef.current) {
      elapsedRef.current.textContent = formatDuration(elapsedMs / 1000);
    }
  }

  const discard = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    cancelAnimationFrame(session.frame);
    session.recorder.ondataavailable = null;
    session.recorder.onstop = null;
    if (session.recorder.state !== "inactive") session.recorder.stop();
    session.stream.getTracks().forEach((track) => track.stop());
    setStream(null);
    setPaused(false);
    setRecording(false);
    paint(0);
  }, []);

  useEffect(() => {
    return () => {
      discard();
    };
  }, [discard]);

  function tick() {
    const session = sessionRef.current;
    if (!session || session.pausedAt) return;
    const elapsedMs = sessionElapsed(session);
    paint(elapsedMs);
    if (elapsedMs >= MAX_RECORD_MS) {
      commit();
      return;
    }
    session.frame = requestAnimationFrame(tick);
  }

  function commit() {
    const session = sessionRef.current;
    if (!session || session.recorder.state === "inactive") return;
    cancelAnimationFrame(session.frame);
    session.recorder.stop();
  }

  function pause() {
    const session = sessionRef.current;
    if (!session || session.recorder.state !== "recording") return;
    cancelAnimationFrame(session.frame);
    session.pausedAt = Date.now();
    session.recorder.pause();
    paint(sessionElapsed(session));
    setPaused(true);
  }

  function resume() {
    const session = sessionRef.current;
    if (!session || session.recorder.state !== "paused") return;
    session.pauseMs += Date.now() - (session.pausedAt ?? Date.now());
    session.pausedAt = null;
    session.recorder.resume();
    setPaused(false);
    session.frame = requestAnimationFrame(tick);
  }

  async function start() {
    if (disabled || sessionRef.current) return;
    const mime = pickRecorderMime();
    if (!mime) {
      toast.error("Recording isn’t supported in this browser.");
      return;
    }

    let nextStream: MediaStream;
    try {
      nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone permission is needed to record.");
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(nextStream, { mimeType: mime });
    const session: Session = {
      recorder,
      stream: nextStream,
      chunks,
      startedAt: Date.now(),
      pauseMs: 0,
      pausedAt: null,
      mime,
      frame: 0,
    };
    sessionRef.current = session;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const duration = sessionElapsed(session);
      session.stream.getTracks().forEach((track) => track.stop());
      const keep = sessionRef.current === session;
      sessionRef.current = null;
      setStream(null);
      setPaused(false);
      setRecording(false);
      paint(0);
      if (!keep || duration < MIN_RECORD_MS) return;
      const type = mime.split(";")[0] ?? "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) return;
      onRecordedRef.current(
        new File([blob], `voice.${recorderExtension(mime)}`, { type }),
      );
    };

    recorder.start(200);
    setStream(nextStream);
    setPaused(false);
    setRecording(true);
    session.frame = requestAnimationFrame(tick);
  }

  return {
    recording,
    paused,
    stream,
    start,
    pause,
    resume,
    commit,
    discard,
    elapsedRef,
  };
}

export function RecordButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Record"
            className="text-muted-foreground"
            onClick={onClick}
          />
        }
      >
        <Mic />
      </TooltipTrigger>
      <TooltipContent>Record</TooltipContent>
    </Tooltip>
  );
}

export function RecordingMeter({
  elapsedRef,
  stream,
  paused,
  onTogglePause,
  onDiscard,
}: {
  elapsedRef: React.RefObject<HTMLSpanElement | null>;
  stream: MediaStream | null;
  paused: boolean;
  onTogglePause: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="status"
      aria-label={paused ? "Recording paused" : "Recording"}
      className="flex min-h-24 min-w-0 items-center gap-2.5 px-3"
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          paused ? "bg-muted-foreground" : "bg-destructive",
        )}
      />
      <LiveWave stream={stream} paused={paused} />
      <span
        ref={elapsedRef}
        className="w-8 shrink-0 text-right font-nums text-[11px] text-muted-foreground"
      >
        0:00
      </span>
      <TooltipIconButton
        label={paused ? "Resume" : "Pause"}
        className="text-muted-foreground"
        onClick={onTogglePause}
      >
        {paused ? <Play /> : <Pause />}
      </TooltipIconButton>
      <TooltipIconButton
        label="Discard"
        className="text-muted-foreground"
        onClick={onDiscard}
      >
        <X />
      </TooltipIconButton>
    </div>
  );
}
