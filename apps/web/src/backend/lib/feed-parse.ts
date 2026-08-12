import { XMLParser } from "fast-xml-parser";

import {
  htmlToPlainText,
  plainTextToHtml,
  sanitizeFeedHtml,
} from "./feed-html";

export type ParsedFeedMeta = {
  kind: "rss" | "atom" | "youtube";
  title: string | null;
  siteUrl: string | null;
  siteName: string | null;
  imageUrl: string | null;
};

export type ParsedFeedEntry = {
  guid: string;
  title: string | null;
  url: string | null;
  author: string | null;
  summary: string | null;
  contentHtml: string | null;
  imageUrl: string | null;
  videoId: string | null;
  publishedAt: Date | null;
};

export type ParsedFeed = ParsedFeedMeta & {
  items: ParsedFeedEntry[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  isArray: (name) =>
    ["item", "entry", "link", "category", "author"].includes(name),
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "#text" in value) {
    return textOf((value as { "#text"?: unknown })["#text"]);
  }
  return null;
}

function linkHref(links: unknown, rel?: string): string | null {
  for (const link of asArray(links)) {
    if (typeof link === "string") return link;
    if (!link || typeof link !== "object") continue;
    const row = link as Record<string, unknown>;
    const href = textOf(row["@_href"]) || textOf(row["#text"]);
    const linkRel = textOf(row["@_rel"]) || "alternate";
    if (!href) continue;
    if (!rel || linkRel === rel) return href;
  }
  return null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickContentHtml(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const trimmed = raw.trim();
    if (/<[a-z][\s\S]*>/i.test(trimmed)) {
      return sanitizeFeedHtml(trimmed);
    }
    return sanitizeFeedHtml(plainTextToHtml(trimmed));
  }
  return null;
}

function youtubeVideoIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    const shorts = parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?#]+)/);
    if (shorts?.[1]) return shorts[1];
  } catch {
    return null;
  }
  return null;
}

function parseRss(channel: Record<string, unknown>): ParsedFeed {
  const items: ParsedFeedEntry[] = [];
  for (const item of asArray(channel.item as unknown)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = textOf(row.title);
    const url = textOf(row.link) || linkHref(row.link);
    const guid = textOf(row.guid) || url || title;
    if (!guid) continue;
    const contentHtml = pickContentHtml(
      textOf(row["content:encoded"]),
      textOf(row.content),
      textOf(row.description),
    );
    const summary =
      textOf(row.description) != null
        ? htmlToPlainText(textOf(row.description)!)
        : contentHtml
          ? htmlToPlainText(contentHtml).slice(0, 280)
          : null;
    const enclosure = row.enclosure as Record<string, unknown> | undefined;
    const imageUrl =
      textOf(enclosure?.["@_url"]) ||
      textOf(row["media:thumbnail"] && (row["media:thumbnail"] as Record<string, unknown>)["@_url"]) ||
      null;

    items.push({
      guid,
      title,
      url,
      author: textOf(row["dc:creator"]) || textOf(row.author),
      summary,
      contentHtml,
      imageUrl,
      videoId: youtubeVideoIdFromUrl(url),
      publishedAt: parseDate(textOf(row.pubDate) || textOf(row["dc:date"])),
    });
  }

  const image = channel.image as Record<string, unknown> | undefined;
  return {
    kind: "rss",
    title: textOf(channel.title),
    siteUrl: textOf(channel.link) || linkHref(channel.link),
    siteName: textOf(channel.title),
    imageUrl: textOf(image?.url) || null,
    items,
  };
}

function parseAtom(
  root: Record<string, unknown>,
  youtube: boolean,
): ParsedFeed {
  const items: ParsedFeedEntry[] = [];
  for (const entry of asArray(root.entry as unknown)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const title = textOf(row.title);
    const url = linkHref(row.link, "alternate") || linkHref(row.link);
    const guid = textOf(row.id) || url || title;
    if (!guid) continue;

    const contentNode = row.content as Record<string, unknown> | string | undefined;
    const contentText =
      typeof contentNode === "string"
        ? contentNode
        : textOf(contentNode) || textOf((contentNode as Record<string, unknown> | undefined)?.["#text"]);
    const summaryNode = row.summary;
    const summaryText = textOf(summaryNode);

    const mediaGroup = row["media:group"] as Record<string, unknown> | undefined;
    const mediaDesc = textOf(mediaGroup?.["media:description"]);
    const mediaThumb = mediaGroup?.["media:thumbnail"] as
      | Record<string, unknown>
      | Array<Record<string, unknown>>
      | undefined;
    const thumb = Array.isArray(mediaThumb) ? mediaThumb[0] : mediaThumb;
    const imageUrl = textOf(thumb?.["@_url"]);

    const videoId =
      textOf(row["yt:videoId"]) ||
      youtubeVideoIdFromUrl(url) ||
      null;

    const contentHtml = pickContentHtml(contentText, mediaDesc, summaryText);
    const summary = summaryText
      ? htmlToPlainText(summaryText)
      : mediaDesc
        ? mediaDesc.slice(0, 280)
        : contentHtml
          ? htmlToPlainText(contentHtml).slice(0, 280)
          : null;

    items.push({
      guid,
      title,
      url,
      author:
        textOf(
          asArray(row.author)[0] &&
            (asArray(row.author)[0] as Record<string, unknown>).name,
        ) || null,
      summary,
      contentHtml,
      imageUrl,
      videoId,
      publishedAt: parseDate(
        textOf(row.published) || textOf(row.updated),
      ),
    });
  }

  const author = asArray(root.author)[0] as Record<string, unknown> | undefined;
  return {
    kind: youtube ? "youtube" : "atom",
    title: textOf(root.title),
    siteUrl: linkHref(root.link, "alternate") || linkHref(root.link),
    siteName: textOf(author?.name) || textOf(root.title),
    imageUrl: null,
    items,
  };
}

export function parseFeedXml(xml: string, sourceUrl: string): ParsedFeed {
  const doc = parser.parse(xml) as Record<string, unknown>;
  if (doc.rss && typeof doc.rss === "object") {
    const channel = (doc.rss as Record<string, unknown>).channel;
    if (channel && typeof channel === "object") {
      return parseRss(channel as Record<string, unknown>);
    }
  }
  if (doc.feed && typeof doc.feed === "object") {
    const feedRoot = doc.feed as Record<string, unknown>;
    const isYoutube =
      sourceUrl.includes("youtube.com/feeds/videos.xml") ||
      Boolean(feedRoot["@_xmlns:yt"]) ||
      asArray(feedRoot.entry).some(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          "yt:videoId" in (entry as object),
      );
    return parseAtom(feedRoot, isYoutube);
  }
  throw new Error("Unrecognized feed format");
}
