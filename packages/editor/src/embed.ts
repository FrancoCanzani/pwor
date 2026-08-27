const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
export const TWEET_ID_RE = /^\d{1,20}$/;
export const TWEET_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "mobile.twitter.com",
]);

function asUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

export function youtubeIdFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;
  const url = asUrl(trimmed);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID_RE.test(id) ? id : null;
  }
  if (
    host !== "youtube.com" &&
    host !== "m.youtube.com" &&
    host !== "music.youtube.com" &&
    host !== "youtube-nocookie.com"
  ) {
    return null;
  }
  const video = url.searchParams.get("v");
  if (video && YOUTUBE_ID_RE.test(video)) return video;
  const nested = url.pathname.match(
    /\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]{11})/,
  );
  return nested?.[1] ?? null;
}

export function tweetIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (!TWEET_HOSTS.has(host)) return null;
    const match = parsed.pathname.match(/\/status\/(\d{1,20})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function tweetIdFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (TWEET_ID_RE.test(trimmed)) return trimmed;
  return tweetIdFromUrl(asUrl(trimmed)?.toString() ?? trimmed);
}

export function youtubeWatchUrl(id: string): string {
  return `https://youtu.be/${id}`;
}

export function tweetStatusUrl(id: string): string {
  return `https://x.com/i/status/${id}`;
}
