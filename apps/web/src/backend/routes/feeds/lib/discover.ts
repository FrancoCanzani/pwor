import { isYoutubeUrl, resolveYoutubeFeedUrl } from "./youtube";
import { assertPublicHttpUrl } from "../../../lib/safe-url";

const FEED_LINK_RE =
  /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/gi;
const HREF_RE = /href=["']([^"']+)["']/i;

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export async function resolveFeedUrl(input: string): Promise<{
  feedUrl: string;
  youtube: boolean;
}> {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = assertPublicHttpUrl(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
  } catch {
    throw new Error("Enter a valid URL");
  }

  if (isYoutubeUrl(url.toString())) {
    const resolved = await resolveYoutubeFeedUrl(url.toString());
    return { feedUrl: resolved.feedUrl, youtube: true };
  }

  // Already looks like a feed path.
  if (
    /\/(feed|rss|atom)(\.xml)?\/?$/i.test(url.pathname) ||
    url.pathname.endsWith(".xml") ||
    url.pathname.endsWith(".rss") ||
    url.pathname.endsWith(".atom")
  ) {
    return { feedUrl: url.toString(), youtube: false };
  }

  const response = await fetch(url.toString(), {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent": "PworFeedBot/1.0 (+https://pwor.app)",
      Accept:
        "text/html, application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });
  if (!response.ok) {
    throw new Error("Could not fetch URL");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const finalUrl = response.url || url.toString();
  const body = await response.text();

  if (
    contentType.includes("xml") ||
    contentType.includes("rss") ||
    contentType.includes("atom") ||
    /^\s*<(\?xml|rss|feed)\b/i.test(body)
  ) {
    return { feedUrl: finalUrl, youtube: false };
  }

  FEED_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FEED_LINK_RE.exec(body))) {
    const tag = match[0];
    const hrefMatch = tag.match(HREF_RE);
    if (hrefMatch?.[1]) {
      return {
        feedUrl: absolutize(hrefMatch[1], finalUrl),
        youtube: false,
      };
    }
  }

  // Common fallbacks
  for (const path of [
    "/feed",
    "/rss",
    "/atom.xml",
    "/feed.xml",
    "/index.xml",
  ]) {
    try {
      const candidate = new URL(path, finalUrl).toString();
      const probe = await fetch(candidate, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
        headers: {
          "User-Agent": "PworFeedBot/1.0 (+https://pwor.app)",
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
      });
      if (!probe.ok) continue;
      const probeType = probe.headers.get("content-type") ?? "";
      const probeBody = (await probe.text()).slice(0, 2000);
      if (
        probeType.includes("xml") ||
        probeType.includes("rss") ||
        probeType.includes("atom") ||
        /^\s*<(\?xml|rss|feed)\b/i.test(probeBody)
      ) {
        return { feedUrl: probe.url || candidate, youtube: false };
      }
    } catch {
      // try next
    }
  }

  throw new Error("No feed found at that URL");
}
