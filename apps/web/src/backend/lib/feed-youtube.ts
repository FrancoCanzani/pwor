/** Resolve a YouTube channel / handle / feed URL to the Atom videos feed. */

const CHANNEL_FEED = (id: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;

const CHANNEL_ID_RE = /^UC[\w-]{20,}$/;

function extractChannelId(html: string): string | null {
  const patterns = [
    /"channelId"\s*:\s*"(UC[\w-]{20,})"/,
    /"externalId"\s*:\s*"(UC[\w-]{20,})"/,
    /<meta\s+itemprop="channelId"\s+content="(UC[\w-]{20,})"/i,
    /\/channel\/(UC[\w-]{20,})/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && CHANNEL_ID_RE.test(match[1])) return match[1];
  }
  return null;
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

  const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]{20,})/);
  if (channelMatch?.[1]) {
    return {
      feedUrl: CHANNEL_FEED(channelMatch[1]),
      channelId: channelMatch[1],
    };
  }

  // @handle, /c/, /user/, or bare channel pages — scrape channelId.
  const pageUrl = url.toString();
  const response = await fetch(pageUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "PworFeedBot/1.0 (+https://pwor.app)",
      Accept: "text/html",
    },
  });
  if (!response.ok) {
    throw new Error("Could not resolve YouTube channel");
  }
  const html = (await response.text()).slice(0, 400_000);
  const channelId = extractChannelId(html);
  if (!channelId) {
    throw new Error("Could not find YouTube channel id");
  }
  return { feedUrl: CHANNEL_FEED(channelId), channelId };
}
