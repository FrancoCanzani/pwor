import { assertPublicHttpUrl } from "../../../lib/safe-url";

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return null;
}

export type FetchedPage = {
  title: string | null;
  siteName: string | null;
  description: string | null;
  text: string | null;
  html: string | null;
};

const EMPTY_PAGE: FetchedPage = {
  title: null,
  siteName: null,
  description: null,
  text: null,
  html: null,
};

export async function fetchPageMetadata(url: string): Promise<FetchedPage> {
  try {
    assertPublicHttpUrl(url);
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return EMPTY_PAGE;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return {
        ...EMPTY_PAGE,
        siteName: new URL(url).hostname,
      };
    }

    const html = (await response.text()).slice(0, 2_000_000);
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      (titleMatch?.[1] ? decodeEntities(titleMatch[1].trim()) : null);
    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "description") ||
      metaContent(html, "twitter:description");
    const siteName = metaContent(html, "og:site_name") || new URL(url).hostname;

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6_000);

    return {
      title: title?.slice(0, 200) || null,
      siteName,
      description: description?.slice(0, 500) || null,
      text: stripped || null,
      html,
    };
  } catch {
    return EMPTY_PAGE;
  }
}
