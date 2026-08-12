import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { parseHTML } from "linkedom";

import { htmlToPlainText, sanitizeFeedHtml } from "./feed-html";

const MAX_HTML_BYTES = 1_500_000;
const MIN_FEED_BODY_CHARS = 900;

export type ExtractedArticle = {
  title: string | null;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  contentHtml: string;
  textContent: string;
  imageUrl: string | null;
};

/** Prefer the richer HTML body when syncing so we don't clobber Readability. */
export function preferRicherHtml(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const a = existing?.trim() || null;
  const b = incoming?.trim() || null;
  if (!a) return b;
  if (!b) return a;
  const aLen = htmlToPlainText(a).length;
  const bLen = htmlToPlainText(b).length;
  if (bLen > aLen * 1.15) return b;
  return a;
}

export function isThinArticleHtml(html: string | null | undefined): boolean {
  if (!html?.trim()) return true;
  return htmlToPlainText(html).length < MIN_FEED_BODY_CHARS;
}

function absolutizeUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Rewrite relative src/href in extracted HTML against the article URL. */
export function absolutizeHtmlUrls(html: string, baseUrl: string): string {
  return html.replace(
    /\s(href|src)=["']([^"']+)["']/gi,
    (match, attr: string, value: string) => {
      if (
        !value ||
        value.startsWith("#") ||
        value.startsWith("data:") ||
        value.startsWith("mailto:") ||
        value.startsWith("javascript:")
      ) {
        return match;
      }
      const absolute = absolutizeUrl(value, baseUrl);
      if (!absolute) return match;
      return ` ${attr}="${absolute}"`;
    },
  );
}

function firstImageFromHtml(html: string, baseUrl: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match?.[1]) return null;
  return absolutizeUrl(match[1], baseUrl);
}

export async function fetchHtmlDocument(
  url: string,
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "PworReaderBot/1.0 (+https://pwor.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("html") &&
      !contentType.includes("text") &&
      !contentType.includes("xml")
    ) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    const bytes = buffer.byteLength > MAX_HTML_BYTES
      ? buffer.slice(0, MAX_HTML_BYTES)
      : buffer;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { html, finalUrl: response.url || url };
  } catch {
    return null;
  }
}

export function extractArticleFromHtml(
  html: string,
  url: string,
): ExtractedArticle | null {
  const { document } = parseHTML(html);
  // Readability uses document.baseURI / documentURL when resolving.
  try {
    Object.defineProperty(document, "documentURI", {
      value: url,
      configurable: true,
    });
    Object.defineProperty(document, "URL", {
      value: url,
      configurable: true,
    });
  } catch {
    // linkedom may already expose these
  }

  if (!isProbablyReaderable(document as unknown as Document)) {
    return null;
  }

  const parsed = new Readability(document as unknown as Document, {
    charThreshold: 200,
  }).parse();

  if (!parsed?.content?.trim()) return null;

  const contentHtml = sanitizeFeedHtml(
    absolutizeHtmlUrls(parsed.content, url),
  );
  if (!contentHtml) return null;

  const textContent =
    parsed.textContent?.trim() || htmlToPlainText(contentHtml);
  if (textContent.length < 120) return null;

  return {
    title: parsed.title?.trim() || null,
    byline: parsed.byline?.trim() || null,
    siteName: parsed.siteName?.trim() || null,
    excerpt: parsed.excerpt?.trim() || null,
    contentHtml,
    textContent: textContent.slice(0, 20_000),
    imageUrl: firstImageFromHtml(contentHtml, url),
  };
}

export async function extractArticleFromUrl(
  url: string,
): Promise<ExtractedArticle | null> {
  const fetched = await fetchHtmlDocument(url);
  if (!fetched) return null;
  return extractArticleFromHtml(fetched.html, fetched.finalUrl);
}
