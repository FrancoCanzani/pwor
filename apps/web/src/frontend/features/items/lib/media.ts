import { shouldCaptureScreenshot } from "@shared/preview";
import { tweetIdFromUrl } from "@shared/tweet";

import type { Item } from "@features/items/api";

export function itemFileUrl(id: string) {
  return `/api/items/${id}/file`;
}

export function itemOpenHref(item: Item): string | null {
  if (item.kind === "link") return item.url;
  return itemFileUrl(item.id);
}

export function itemPreviewUrl(id: string) {
  return `/api/items/${id}/preview`;
}

export function itemHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function itemAwaitingScreenshot(item: Item): boolean {
  if (item.hasPreview) return false;
  if (item.kind !== "link") return false;
  if (item.parseStatus === "failed" || item.parseStatus === "skipped") {
    return false;
  }
  return shouldCaptureScreenshot(item.url);
}

export function isVideoFile(item: Item): boolean {
  return item.kind === "file" && Boolean(item.mimeType?.startsWith("video/"));
}

export function isPdfFile(item: Pick<Item, "mimeType">): boolean {
  return item.mimeType === "application/pdf";
}

export function itemTweetId(item: Item): string | null {
  if (item.kind !== "link" || !item.url) return null;
  return tweetIdFromUrl(item.url);
}

export function itemStillUrl(item: Item): string | null {
  if (itemTweetId(item)) return null;
  if (item.hasPreview) return itemPreviewUrl(item.id);
  if (item.kind === "file" && item.mimeType?.startsWith("image/")) {
    return itemFileUrl(item.id);
  }
  return null;
}

let current: HTMLVideoElement | null = null;

export function canHoverPlay() {
  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function claimPlayback(el: HTMLVideoElement) {
  if (current && current !== el) current.pause();
  current = el;
}

export function releasePlayback(el: HTMLVideoElement) {
  if (current !== el) return;
  el.pause();
  current = null;
}

const POSTER_MAX_EDGE = 1280;
const POSTER_QUALITY = 0.82;
const POSTER_TIMEOUT_MS = 4000;

export async function captureVideoPoster(file: File): Promise<File | null> {
  if (!file.type.startsWith("video/")) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("timeout")),
        POSTER_TIMEOUT_MS,
      );
      video.addEventListener(
        "loadeddata",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      video.addEventListener(
        "error",
        () => {
          window.clearTimeout(timer);
          reject(new Error("load"));
        },
        { once: true },
      );
    });

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      await video.play();
      video.pause();
    }

    if (video.currentTime !== 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error("seek")),
          1500,
        );
        video.addEventListener(
          "seeked",
          () => {
            window.clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        video.currentTime = 0;
      });
    }

    const scale = Math.min(
      1,
      POSTER_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight, 1),
    );
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", POSTER_QUALITY);
    });
    if (!blob) return null;
    return new File([blob], "poster.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
