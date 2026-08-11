const URL_RE = /^https?:\/\/\S+$/i;

export function extractUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!URL_RE.test(trimmed)) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

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
};

export async function fetchPageMetadata(url: string): Promise<FetchedPage> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "PworVaultBot/1.0 (+https://pwor.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return { title: null, siteName: null, description: null, text: null };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return {
        title: null,
        siteName: new URL(url).hostname,
        description: null,
        text: null,
      };
    }

    const html = (await response.text()).slice(0, 200_000);
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      (titleMatch?.[1] ? decodeEntities(titleMatch[1].trim()) : null);
    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "description") ||
      metaContent(html, "twitter:description");
    const siteName =
      metaContent(html, "og:site_name") || new URL(url).hostname;

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
    };
  } catch {
    return { title: null, siteName: null, description: null, text: null };
  }
}

export function titleFromText(content: string): string {
  const line = content.trim().split(/\n/)[0] ?? content.trim();
  return line.length > 60 ? `${line.slice(0, 60).trim()}…` : line;
}

export function vaultSearchText(parts: {
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  extractedMarkdown?: string | null;
  tags?: string[] | null;
}): string {
  return [
    parts.title,
    parts.summary,
    parts.content,
    parts.extractedMarkdown,
    ...(parts.tags ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");
}
