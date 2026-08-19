export const MAX_RECORD_MS = 3 * 60 * 1000;
export const MIN_RECORD_MS = 400;
export const SKIP_S = 15;
export const PLAYBACK_RATES = [1, 1.5, 2] as const;

const RECORDER_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function recorderExtension(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function nextPlaybackRate(rate: number): number {
  const index = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? 1;
}

export function formatRate(rate: number): string {
  return `${rate}x`;
}
