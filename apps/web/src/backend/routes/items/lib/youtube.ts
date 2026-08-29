import { decode } from "he";

import { assertPublicHttpUrl } from "../../../lib/safe-url";

const VIDEO_ID_RE = /^[\w-]{11}$/;

export function youtubeVideoIdFromUrl(input: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && VIDEO_ID_RE.test(id) ? id : null;
    }
    if (
      host !== "youtube.com" &&
      host !== "m.youtube.com" &&
      host !== "music.youtube.com"
    ) {
      return null;
    }
    const fromQuery = url.searchParams.get("v")?.trim();
    if (fromQuery && VIDEO_ID_RE.test(fromQuery)) return fromQuery;
    const fromPath = url.pathname.match(
      /\/(?:shorts|embed|live|v)\/([^/?#]+)/,
    )?.[1];
    return fromPath && VIDEO_ID_RE.test(fromPath) ? fromPath : null;
  } catch {
    return null;
  }
}

function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const INNERTUBE_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
// WEB InnerTube needs a Proof of Origin token; ANDROID does not.
const ANDROID_UA =
  "com.google.android.youtube/20.10.38 (Linux; U; Android 14)";
const MAX_CAPTION_CHARS = 100_000;
const FETCH_MS = 15_000;

export type YoutubeVideo = {
  videoId: string;
  title: string | null;
  description: string | null;
  channel: string | null;
  captions: string | null;
};

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
};

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: {
    title?: string;
    shortDescription?: string;
    author?: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
};

type TimedTextEvent = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
};

function clipCaptions(value: string): string {
  if (value.length <= MAX_CAPTION_CHARS) return value;
  return value.slice(0, MAX_CAPTION_CHARS).trimEnd();
}

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const usable = tracks.filter((track) => track.baseUrl);
  if (usable.length === 0) return null;
  const lang = (track: CaptionTrack) =>
    (track.languageCode ?? "").toLowerCase();
  const manual = (track: CaptionTrack) => track.kind !== "asr";
  return (
    usable.find((track) => lang(track) === "en" && manual(track)) ??
    usable.find((track) => lang(track).startsWith("en") && manual(track)) ??
    usable.find((track) => lang(track) === "en") ??
    usable.find((track) => lang(track).startsWith("en")) ??
    usable.find(manual) ??
    usable[0] ??
    null
  );
}

function withCaptionFmt(baseUrl: string, fmt: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", fmt);
  return url.toString();
}

function textFromJson3(data: { events?: TimedTextEvent[] }): string | null {
  const events = data.events;
  if (!Array.isArray(events) || events.length === 0) return null;
  const parts: string[] = [];
  let lastEnd = 0;
  for (const event of events) {
    const raw = (event.segs ?? []).map((seg) => seg.utf8 ?? "").join("");
    const text = decode(raw).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = event.tStartMs ?? 0;
    if (parts.length > 0) parts.push(start - lastEnd > 2_500 ? "\n\n" : " ");
    parts.push(text);
    lastEnd = start + (event.dDurationMs ?? 0);
  }
  const joined = parts.join("").trim();
  return joined ? clipCaptions(joined) : null;
}

function textFromTimedTextXml(xml: string): string | null {
  const parts: string[] = [];
  const re = /<text(?:\s[^>]*)?>([\s\S]*?)<\/text>/gi;
  for (const match of xml.matchAll(re)) {
    const text = decode((match[1] ?? "").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (text) parts.push(text);
  }
  if (parts.length === 0) return null;
  return clipCaptions(parts.join(" "));
}

async function fetchCaptions(baseUrl: string): Promise<string | null> {
  let url: string;
  try {
    url = withCaptionFmt(baseUrl, "json3");
    assertPublicHttpUrl(url);
  } catch {
    return null;
  }

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_MS),
    headers: { "User-Agent": ANDROID_UA },
  });
  if (!response.ok) return null;
  const raw = (await response.text()).trim();
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return textFromJson3(JSON.parse(raw) as { events?: TimedTextEvent[] });
    } catch {
      return null;
    }
  }
  return textFromTimedTextXml(raw);
}

async function fetchPlayer(videoId: string): Promise<PlayerResponse | null> {
  const response = await fetch(INNERTUBE_URL, {
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_MS),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ANDROID_UA,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
          hl: "en",
          gl: "US",
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });
  if (!response.ok) return null;
  return (await response.json()) as PlayerResponse;
}

export async function fetchYoutubeVideo(
  url: string,
): Promise<YoutubeVideo | null> {
  const videoId = youtubeVideoIdFromUrl(url);
  if (!videoId) return null;

  try {
    const player = await fetchPlayer(videoId);
    if (!player) return null;
    const status = player.playabilityStatus?.status;
    if (status && status !== "OK" && !player.videoDetails) return null;

    const track = pickCaptionTrack(
      player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [],
    );
    const captions = track?.baseUrl
      ? await fetchCaptions(track.baseUrl)
      : null;

    const title = player.videoDetails?.title?.trim() || null;
    const description = player.videoDetails?.shortDescription?.trim() || null;
    const channel = player.videoDetails?.author?.trim() || null;
    if (!title && !description && !captions) return null;

    return { videoId, title, description, channel, captions };
  } catch {
    return null;
  }
}

export function youtubeCaptionsHtml(captions: string): string {
  return plainTextToHtml(captions);
}
