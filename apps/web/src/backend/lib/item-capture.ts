import {
  inferLanguageFromContent,
  looksLikeCode,
} from "@shared/infer-language";
import {
  dedentCode,
  titleFromSnippet,
  titleFromText,
} from "@shared/snippet-format";

import normalizeUrlLib from "normalize-url";

import { assertPublicHttpUrl } from "./safe-url";

const TRACKING_PARAMS = [
  /^utm_/,
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  /^mc_[ce]id$/,
  "igshid",
  "si",
  "ref",
  "ref_src",
  "ref_url",
  "_hsenc",
  "_hsmi",
  "spm",
];

const TWEET_RE =
  /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/i;
const URL_RE = /^https?:\/\/\S+$/i;

export type ParsedCapture =
  | { type: "url"; url: string }
  | { type: "snippet"; content: string; language: string | null }
  | { type: "text"; content: string };

export function parseCaptureInput(input: string): ParsedCapture {
  const trimmed = input.trim();
  const url = extractUrl(trimmed);
  if (url) return { type: "url", url };
  if (looksLikeCode(trimmed)) {
    const content = dedentCode(trimmed);
    return {
      type: "snippet",
      content,
      language: inferLanguageFromContent(content),
    };
  }
  return { type: "text", content: trimmed };
}

export { dedentCode, titleFromSnippet, titleFromText };

export function normalizeUrl(rawUrl: string): string | null {
  try {
    return normalizeUrlLib(rawUrl, {
      stripWWW: true,
      stripHash: true,
      removeTrailingSlash: true,
      sortQueryParameters: true,
      removeQueryParameters: TRACKING_PARAMS,
    });
  } catch {
    return null;
  }
}

export function extractUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!URL_RE.test(trimmed) && !TWEET_RE.test(trimmed)) return null;
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
  html: string | null;
};

export async function fetchPageMetadata(url: string): Promise<FetchedPage> {
  try {
    assertPublicHttpUrl(url);
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": "PworItemBot/1.0 (+https://pwor.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return {
        title: null,
        siteName: null,
        description: null,
        text: null,
        html: null,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return {
        title: null,
        siteName: new URL(url).hostname,
        description: null,
        text: null,
        html: null,
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
    return {
      title: null,
      siteName: null,
      description: null,
      text: null,
      html: null,
    };
  }
}

/** Stored kinds only. Legacy DB values `site` / `tweet` normalize to `link`. */
export type ItemStoredKind = "file" | "link" | "text" | "snippet";

export function normalizeItemKind(kind: string): ItemStoredKind {
  switch (kind) {
    case "file":
    case "link":
    case "text":
    case "snippet":
      return kind;
    case "site":
    case "tweet":
      return "link";
    default:
      return "file";
  }
}
