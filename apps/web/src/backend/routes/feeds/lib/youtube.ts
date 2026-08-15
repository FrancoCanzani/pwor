const CHANNEL_FEED = (id: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;

const CHANNEL_ID_RE = /^UC[\w-]{20,}$/;
const CHANNEL_ID_CAPTURE = "(UC[\\w-]{20,})";
const HTML_BYTES = 2_500_000;

function extractChannelId(html: string): string | null {
  const patterns = [
    // Channel pages put the videos RSS link and canonical /channel/UC… late
    // in the document. Prefer those over the first "channelId" JSON key —
    // that key often belongs to a related channel.
    new RegExp(`feeds/videos\\.xml\\?channel_id=${CHANNEL_ID_CAPTURE}`),
    new RegExp(
      `rel=["']canonical["'][^>]*href=["'][^"']*/channel/${CHANNEL_ID_CAPTURE}`,
      "i",
    ),
    new RegExp(
      `href=["'][^"']*/channel/${CHANNEL_ID_CAPTURE}["'][^>]*rel=["']canonical["']`,
      "i",
    ),
    new RegExp(`"externalId"\\s*:\\s*"${CHANNEL_ID_CAPTURE}"`),
    new RegExp(`"browseId"\\s*:\\s*"${CHANNEL_ID_CAPTURE}"`),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && CHANNEL_ID_RE.test(match[1])) return match[1];
  }
  return null;
}

function channelIdFromPath(pathname: string): string | null {
  const match = pathname.match(new RegExp(`^/channel/${CHANNEL_ID_CAPTURE}`));
  return match?.[1] && CHANNEL_ID_RE.test(match[1]) ? match[1] : null;
}

export function isYoutubeUrl(input: string): boolean {
  try {
    const host = new URL(input).hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

export async function resolveYoutubeFeedUrl(
  input: string,
): Promise<{ feedUrl: string; channelId: string | null }> {
  const url = new URL(input);

  if (url.pathname === "/feeds/videos.xml") {
    const channelId = url.searchParams.get("channel_id");
    if (channelId && CHANNEL_ID_RE.test(channelId)) {
      return { feedUrl: CHANNEL_FEED(channelId), channelId };
    }
  }

  const fromPath = channelIdFromPath(url.pathname);
  if (fromPath) {
    return { feedUrl: CHANNEL_FEED(fromPath), channelId: fromPath };
  }

  // @handle, /c/, /user/, or other channel pages — scrape the videos RSS link.
  const response = await fetch(url.toString(), {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent": "PworFeedBot/1.0 (+https://pwor.app)",
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error("Could not resolve YouTube channel");
  }

  const redirected = channelIdFromPath(new URL(response.url).pathname);
  if (redirected) {
    return { feedUrl: CHANNEL_FEED(redirected), channelId: redirected };
  }

  const html = (await response.text()).slice(0, HTML_BYTES);
  const channelId = extractChannelId(html);
  if (!channelId) {
    throw new Error("Could not find YouTube channel id");
  }
  return { feedUrl: CHANNEL_FEED(channelId), channelId };
}

export function channelIdFromFeedUrl(url: string): string | null {
  try {
    const id = new URL(url).searchParams.get("channel_id");
    return id && CHANNEL_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

function unescapeUrl(value: string): string {
  return value
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

function sizedAvatar(url: string): string {
  return /=s\d+/.test(url) ? url.replace(/=s\d+/, "=s88") : url;
}

function extractChannelAvatar(html: string): string | null {
  const avatar = html.match(
    /"channelMetadataRenderer"[\s\S]{0,4000}"avatar"\s*:\s*\{\s*"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/,
  );
  if (avatar?.[1]) return sizedAvatar(unescapeUrl(avatar[1]));

  const og =
    html.match(
      /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i,
    );
  const ogUrl = og?.[1] ? unescapeUrl(og[1]) : null;
  if (
    ogUrl &&
    /yt3\.(ggpht|googleusercontent)\.com/.test(ogUrl) &&
    !/fcrop/.test(ogUrl)
  ) {
    return sizedAvatar(ogUrl);
  }
  return null;
}

export async function fetchYoutubeChannelAvatar(
  channelId: string,
): Promise<string | null> {
  const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent": "PworFeedBot/1.0 (+https://pwor.app)",
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) return null;
  const html = (await response.text()).slice(0, HTML_BYTES);
  return extractChannelAvatar(html);
}
