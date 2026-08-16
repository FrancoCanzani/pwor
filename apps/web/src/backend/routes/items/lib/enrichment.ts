import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import { createDb } from "../../../db";
import { item } from "../../../db/schema";
import { assertPublicHttpUrl } from "../../../lib/safe-url";
import { tweetIdFromUrl } from "@shared/tweet";
import { titleFromText } from "./capture";
import { extractArticleHtml } from "./extract";
import {
  shouldCaptureScreenshot,
  storeSiteScreenshot,
} from "./screenshot";
import { extractItemMarkdown } from "./to-markdown";
import { fetchTweet, tweetToHtml } from "./tweet";

const ENRICHMENT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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

type FetchedPage = {
  title: string | null;
  siteName: string | null;
  description: string | null;
  text: string | null;
  html: string | null;
};

async function fetchPageMetadata(url: string): Promise<FetchedPage> {
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
    return {
      title: null,
      siteName: null,
      description: null,
      text: null,
      html: null,
    };
  }
}

const ENRICHMENT_SYSTEM_PROMPT = `You enrich a saved item for later search and recall.

Return:
- title: short plain title (under 80 chars). Prefer page title when present. Never invent brands you weren't given.
- summary: 1–2 sentences on what this is and why it matters. Neutral tone.
- tags: exactly 3 short lowercase tags (1–3 words each), ranked most useful first. Pick the 3 most distinctive and non-overlapping — concrete nouns (topics, entities, places, brands), not generic filler like "link", "interesting", "app", "productivity", or the media type. Prefer specific over broad (e.g. "note-taking" over "productivity tool").`;

const MAX_TAGS = 3;

const enrichmentSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).min(1).max(MAX_TAGS),
});

const BODY_CHARS = 6_000;

function filenameFromR2Key(r2Key: string | null): string | null {
  if (!r2Key) return null;
  const name = r2Key.slice(r2Key.lastIndexOf("/") + 1);
  return name || null;
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag.slice(0, 40));
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export async function enrichItem(
  env: Env,
  itemId: string,
): Promise<void> {
  const db = createDb(env.DB);
  const [initial] = await db
    .select()
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (!initial) return;

  let row = initial;
  const kind = row.kind;

  if (kind === "link" && row.url) {
    const tweetId = tweetIdFromUrl(row.url);
    const tweet = tweetId ? await fetchTweet(tweetId) : null;

    let title = row.title;
    let siteName = row.siteName;
    let summary = row.summary;
    let content = row.content;
    let contentHtml = row.contentHtml;

    if (tweet) {
      title = titleFromText(tweet.text) || row.title || row.url;
      siteName = "X";
      summary = tweet.text.slice(0, 500) || row.summary;
      content = tweet.text || row.content;
      contentHtml = tweetToHtml(tweet);
    } else {
      const page = await fetchPageMetadata(row.url);
      title = page.title || row.title || row.url;
      siteName = page.siteName ?? row.siteName;
      summary = page.description ?? row.summary;
      content =
        [page.description, page.text].filter(Boolean).join("\n\n") ||
        row.content;
      if (page.html) {
        const extracted = extractArticleHtml(page.html, row.url);
        if (extracted) contentHtml = extracted.html;
        else console.error("link content extraction failed", itemId);
      }
    }

    await db
      .update(item)
      .set({
        kind: "link",
        title,
        siteName,
        summary,
        content,
        contentHtml,
      })
      .where(eq(item.id, itemId));

    row = {
      ...row,
      kind: "link",
      title,
      siteName,
      summary,
      content,
      contentHtml,
    };
  }

  if (kind === "file" && row.r2Key && !row.extractedMarkdown) {
    await extractItemMarkdown(env, itemId);
    const [refreshed] = await db
      .select()
      .from(item)
      .where(eq(item.id, itemId))
      .limit(1);
    if (!refreshed) return;
    row = refreshed;
  }

  const bodyParts = [
    row.title ? `Title: ${row.title}` : null,
    row.url ? `URL: ${row.url}` : null,
    row.siteName ? `Site: ${row.siteName}` : null,
    row.kind ? `Kind: ${row.kind}` : null,
    row.content ? `Content:\n${row.content.slice(0, BODY_CHARS)}` : null,
    row.extractedMarkdown
      ? `Extracted:\n${row.extractedMarkdown.slice(0, BODY_CHARS)}`
      : null,
    row.summary ? `Existing summary: ${row.summary}` : null,
  ].filter(Boolean);

  if (bodyParts.length === 0) {
    await db
      .update(item)
      .set({
        parseStatus: "skipped",
        parseError: "nothing to enrich",
        parsedAt: new Date(),
      })
      .where(eq(item.id, itemId));
    return;
  }

  try {
    const workersai = createWorkersAI({ binding: env.AI });
    const { object } = await generateObject({
      model: workersai(ENRICHMENT_MODEL),
      schema: enrichmentSchema,
      system: ENRICHMENT_SYSTEM_PROMPT,
      prompt: bodyParts.join("\n\n"),
    });

    const tags = normalizeTags([
      ...(Array.isArray(row.tags) ? row.tags : []),
      ...object.tags,
    ]);

    const aiTitle = object.title.trim() || row.title;
    const title =
      kind === "file"
        ? row.title || filenameFromR2Key(row.r2Key) || aiTitle
        : aiTitle;

    await db
      .update(item)
      .set({
        title,
        summary: object.summary.trim(),
        tags,
        kind,
        parseStatus: "ready",
        parseError: null,
        parsedAt: new Date(),
      })
      .where(eq(item.id, itemId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(item)
      .set({
        parseStatus: "failed",
        parseError: message.slice(0, 500),
        parsedAt: new Date(),
      })
      .where(eq(item.id, itemId));
  }
}

async function markEnrichmentFailed(
  env: Env,
  itemId: string,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const db = createDb(env.DB);
  await db
    .update(item)
    .set({
      parseStatus: "failed",
      parseError: message.slice(0, 500),
      parsedAt: new Date(),
    })
    .where(eq(item.id, itemId));
}

async function enrichItemScreenshot(
  env: Env,
  itemId: string,
): Promise<void> {
  const db = createDb(env.DB);
  const [row] = await db
    .select()
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (!row) return;
  if (row.kind !== "link" || !row.url || row.previewR2Key) return;
  if (!shouldCaptureScreenshot(row.url)) return;

  const previewR2Key = await storeSiteScreenshot(
    env,
    row.userId,
    itemId,
    row.url,
  );
  if (!previewR2Key) return;

  await db
    .update(item)
    .set({ previewR2Key })
    .where(eq(item.id, itemId));
}

export function scheduleItemEnrichment(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  itemId: string,
): void {
  ctx.waitUntil(
    enrichItem(env, itemId).catch(async (err) => {
      console.error("item enrichment failed", itemId, err);
      try {
        await markEnrichmentFailed(env, itemId, err);
      } catch (updateErr) {
        console.error("item enrichment status update failed", itemId, updateErr);
      }
    }),
  );
  ctx.waitUntil(
    enrichItemScreenshot(env, itemId).catch((err) => {
      console.error("item screenshot failed", itemId, err);
    }),
  );
}
