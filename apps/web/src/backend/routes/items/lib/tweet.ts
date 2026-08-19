import { decodeTweetText, TWEET_ID_RE, type TweetView } from "@shared/tweet";

function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

type SyndicationUser = {
  name?: string;
  screen_name?: string;
  profile_image_url_https?: string;
};

type SyndicationTweet = {
  __typename?: string;
  id_str?: string;
  text?: string;
  created_at?: string;
  user?: SyndicationUser;
  photos?: { url?: string }[];
  video?: {
    poster?: string;
    variants?: { src?: string; type?: string }[];
  };
  quoted_tweet?: SyndicationTweet;
  note_tweet?: { note_tweet_results?: { result?: { text?: string } } };
};

type FxAuthor = {
  name?: string;
  screen_name?: string;
  avatar_url?: string;
  avatar_url_original?: string;
};

type FxTweet = {
  id?: string;
  url?: string;
  text?: string;
  created_at?: string;
  created_timestamp?: number;
  author?: FxAuthor;
  media?: {
    photos?: { url?: string; altText?: string }[];
    videos?: { url?: string; thumbnail_url?: string }[];
  };
  quote?: FxTweet;
};

function isoFromUnknown(value: string | number | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function bestVideoUrl(
  variants: { src?: string; type?: string }[] | undefined,
): string | null {
  const mp4 = variants?.filter((item) => item.src && item.type?.includes("mp4"));
  return mp4?.[mp4.length - 1]?.src ?? variants?.find((item) => item.src)?.src ?? null;
}

function mapSyndication(tweet: SyndicationTweet, depth: number): TweetView | null {
  const id = tweet.id_str;
  const handle = tweet.user?.screen_name;
  if (!id || !handle) return null;
  const text = decodeTweetText(
    tweet.note_tweet?.note_tweet_results?.result?.text?.trim() ||
      tweet.text?.trim() ||
      "",
  );
  const videoUrl = bestVideoUrl(tweet.video?.variants);

  return {
    id,
    url: `https://x.com/${handle}/status/${id}`,
    text,
    createdAt: isoFromUnknown(tweet.created_at),
    author: {
      name: tweet.user?.name?.trim() || handle,
      handle,
      avatarUrl: tweet.user?.profile_image_url_https ?? null,
    },
    photos: (tweet.photos ?? [])
      .map((photo) => photo.url)
      .filter((url): url is string => Boolean(url))
      .map((url) => ({ url, alt: null })),
    videos:
      tweet.video && (videoUrl || tweet.video.poster)
        ? [{ url: videoUrl, poster: tweet.video.poster ?? null }]
        : [],
    quoted:
      depth === 0 && tweet.quoted_tweet
        ? mapSyndication(tweet.quoted_tweet, 1)
        : null,
  };
}

function mapFx(tweet: FxTweet, depth: number): TweetView | null {
  const id = tweet.id;
  const handle = tweet.author?.screen_name;
  if (!id || !handle) return null;

  return {
    id,
    url: tweet.url?.trim() || `https://x.com/${handle}/status/${id}`,
    text: decodeTweetText(tweet.text?.trim() || ""),
    createdAt:
      isoFromUnknown(tweet.created_timestamp) ?? isoFromUnknown(tweet.created_at),
    author: {
      name: tweet.author?.name?.trim() || handle,
      handle,
      avatarUrl:
        tweet.author?.avatar_url_original ?? tweet.author?.avatar_url ?? null,
    },
    photos: (tweet.media?.photos ?? [])
      .map((photo) => photo.url)
      .filter((url): url is string => Boolean(url))
      .map((url, index) => ({
        url,
        alt: tweet.media?.photos?.[index]?.altText ?? null,
      })),
    videos: (tweet.media?.videos ?? [])
      .filter((video) => video.url || video.thumbnail_url)
      .map((video) => ({
        url: video.url ?? null,
        poster: video.thumbnail_url ?? null,
      })),
    quoted: depth === 0 && tweet.quote ? mapFx(tweet.quote, 1) : null,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;
  return response.json();
}

async function fetchSyndication(id: string): Promise<TweetView | null> {
  const url = new URL("https://cdn.syndication.twimg.com/tweet-result");
  url.searchParams.set("id", id);
  url.searchParams.set("lang", "en");
  url.searchParams.set("token", syndicationToken(id));
  const data = (await fetchJson(url.toString())) as SyndicationTweet | null;
  if (!data || data.__typename === "TweetTombstone") return null;
  return mapSyndication(data, 0);
}

async function fetchFixTweet(id: string): Promise<TweetView | null> {
  const data = await fetchJson(`https://api.fxtwitter.com/status/${id}`);
  if (!data || typeof data !== "object") return null;
  const tweet =
    "tweet" in data
      ? (data as { tweet?: FxTweet }).tweet
      : (data as FxTweet);
  if (!tweet) return null;
  return mapFx(tweet, 0);
}

export async function fetchTweet(id: string): Promise<TweetView | null> {
  if (!TWEET_ID_RE.test(id)) return null;
  try {
    const syndicated = await fetchSyndication(id);
    if (syndicated) return syndicated;
  } catch {
    // Cloudflare IPs are often blocked; FixTweet is the fallback.
  }
  try {
    return await fetchFixTweet(id);
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function tweetToHtml(tweet: TweetView): string {
  const parts = [
    `<p><strong>${escapeHtml(tweet.author.name)}</strong> @${escapeHtml(tweet.author.handle)}</p>`,
    `<p>${escapeHtml(tweet.text).replace(/\n/g, "<br>")}</p>`,
    ...tweet.photos.map(
      (photo) =>
        `<p><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.alt ?? "")}"></p>`,
    ),
  ];
  if (tweet.quoted) {
    parts.push(`<blockquote>${tweetToHtml(tweet.quoted)}</blockquote>`);
  }
  return parts.join("\n");
}
