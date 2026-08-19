export const TWEET_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "mobile.twitter.com",
]);

export const TWEET_ID_RE = /^\d{1,20}$/;

export type TweetPhoto = {
  url: string;
  alt: string | null;
};

export type TweetVideo = {
  url: string | null;
  poster: string | null;
};

export type TweetView = {
  id: string;
  url: string;
  text: string;
  createdAt: string | null;
  author: {
    name: string;
    handle: string;
    avatarUrl: string | null;
  };
  photos: TweetPhoto[];
  videos: TweetVideo[];
  quoted: TweetView | null;
};

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

export function decodeTweetText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
