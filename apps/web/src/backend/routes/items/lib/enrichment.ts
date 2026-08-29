import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import { tweetIdFromUrl } from "@shared/tweet";

import { createDb } from "../../../db";
import { item } from "../../../db/schema";
import { embedItem } from "../../../lib/embed";
import type { WaitUntilCtx } from "../../../types";
import { titleFromText } from "./capture";
import { extractArticleHtml } from "./extract";
import { fetchPageMetadata } from "./page-meta";
import { shouldCaptureScreenshot, storeSiteScreenshot } from "./screenshot";
import { extractFileMarkdown } from "./to-markdown";
import { fetchTweet, tweetToHtml } from "./tweet";
import {
  fetchYoutubeVideo,
  youtubeCaptionsHtml,
  youtubeVideoIdFromUrl,
} from "./youtube";

const ENRICHMENT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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

type ItemRecord = typeof item.$inferSelect;

type Gathered = {
  title: string | null;
  siteName: string | null;
  summary: string | null;
  content: string | null;
  contentHtml: string | null;
  extractedMarkdown: string | null;
};

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

async function gatherEnrichment(env: Env, row: ItemRecord): Promise<Gathered> {
  const gathered: Gathered = {
    title: row.title,
    siteName: row.siteName,
    summary: row.summary,
    content: row.content,
    contentHtml: row.contentHtml,
    extractedMarkdown: row.extractedMarkdown,
  };

  if (row.kind === "link" && row.url) {
    const tweetId = tweetIdFromUrl(row.url);
    const tweet = tweetId ? await fetchTweet(tweetId) : null;

    if (tweet) {
      gathered.title = titleFromText(tweet.text) || row.title || row.url;
      gathered.siteName = "X";
      gathered.summary = tweet.text.slice(0, 500) || row.summary;
      gathered.content = tweet.text || row.content;
      gathered.contentHtml = tweetToHtml(tweet);
    } else {
      const youtube = await fetchYoutubeVideo(row.url);
      if (youtube) {
        gathered.title = youtube.title || row.title || row.url;
        gathered.siteName = "YouTube";
        gathered.summary =
          youtube.description?.slice(0, 500) || row.summary;
        gathered.content =
          [
            youtube.channel ? `Channel: ${youtube.channel}` : null,
            youtube.description,
          ]
            .filter(Boolean)
            .join("\n\n") || row.content;
        if (youtube.captions) {
          gathered.extractedMarkdown = youtube.captions;
          gathered.contentHtml = youtubeCaptionsHtml(youtube.captions);
        } else if (youtube.description) {
          gathered.contentHtml = youtubeCaptionsHtml(youtube.description);
        }
      } else {
        const page = await fetchPageMetadata(row.url);
        gathered.title = page.title || row.title || row.url;
        gathered.siteName = page.siteName ?? row.siteName;
        gathered.summary = page.description ?? row.summary;
        gathered.content =
          [page.description, page.text].filter(Boolean).join("\n\n") ||
          row.content;
        if (page.html) {
          const extracted = extractArticleHtml(page.html, row.url);
          if (extracted) gathered.contentHtml = extracted.html;
          else console.error("link content extraction failed", row.id);
        }
      }
    }
  }

  if (row.kind === "file" && row.r2Key && !row.extractedMarkdown) {
    const extracted = await extractFileMarkdown(env, row);
    if (extracted.status === "extracted") {
      gathered.extractedMarkdown = extracted.markdown;
    }
  }

  return gathered;
}

type ParseWrite = Partial<Gathered> & {
  tags?: string[] | null;
  kind?: ItemRecord["kind"];
  parseStatus: "pending" | "ready" | "failed" | "skipped";
  parseError: string | null;
  parsedAt: Date;
};

async function writeParse(
  env: Env,
  itemId: string,
  values: ParseWrite,
): Promise<void> {
  const db = createDb(env.DB);
  await db.update(item).set(values).where(eq(item.id, itemId));
}

export async function enrichItem(env: Env, itemId: string): Promise<void> {
  const db = createDb(env.DB);
  const [row] = await db
    .select()
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (!row) return;

  const gathered = await gatherEnrichment(env, row);
  const kind = row.kind;

  if (
    gathered.content ||
    gathered.extractedMarkdown ||
    gathered.contentHtml ||
    gathered.title
  ) {
    await writeParse(env, itemId, {
      ...gathered,
      parseStatus: "pending",
      parseError: null,
      parsedAt: new Date(),
    });
  }

  const bodyParts = [
    gathered.title ? `Title: ${gathered.title}` : null,
    row.url ? `URL: ${row.url}` : null,
    gathered.siteName ? `Site: ${gathered.siteName}` : null,
    kind ? `Kind: ${kind}` : null,
    gathered.content
      ? `Content:\n${gathered.content.slice(0, BODY_CHARS)}`
      : null,
    gathered.extractedMarkdown
      ? `Extracted:\n${gathered.extractedMarkdown.slice(0, BODY_CHARS)}`
      : null,
    gathered.summary ? `Existing summary: ${gathered.summary}` : null,
  ].filter(Boolean);

  if (bodyParts.length === 0) {
    await writeParse(env, itemId, {
      ...gathered,
      parseStatus: "skipped",
      parseError: "nothing to enrich",
      parsedAt: new Date(),
    });
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

    const aiTitle = object.title.trim() || gathered.title;
    const title =
      kind === "file"
        ? row.title || filenameFromR2Key(row.r2Key) || aiTitle
        : aiTitle;

    await writeParse(env, itemId, {
      ...gathered,
      title,
      summary: object.summary.trim(),
      tags,
      kind,
      parseStatus: "ready",
      parseError: null,
      parsedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeParse(env, itemId, {
      ...gathered,
      parseStatus: "failed",
      parseError: message.slice(0, 500),
      parsedAt: new Date(),
    });
  }
}

async function enrichItemScreenshot(env: Env, itemId: string): Promise<void> {
  const db = createDb(env.DB);
  const [row] = await db
    .select()
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (!row) return;
  if (row.kind !== "link" || !row.url || row.previewR2Key) return;
  if (youtubeVideoIdFromUrl(row.url)) return;
  if (!shouldCaptureScreenshot(row.url)) return;

  const previewR2Key = await storeSiteScreenshot(
    env,
    row.userId,
    itemId,
    row.url,
  );
  if (!previewR2Key) return;

  await db.update(item).set({ previewR2Key }).where(eq(item.id, itemId));
}

const MAX_SCREENSHOT_BACKFILL = 4;

export function scheduleMissingScreenshots(
  ctx: WaitUntilCtx,
  env: Env,
  rows: Array<{
    id: string;
    kind: "file" | "link" | "text";
    url: string | null;
    previewR2Key: string | null;
  }>,
): void {
  const missing = rows.filter(
    (row) =>
      row.kind === "link" &&
      row.url &&
      !row.previewR2Key &&
      !youtubeVideoIdFromUrl(row.url) &&
      shouldCaptureScreenshot(row.url),
  );
  if (missing.length === 0) return;
  ctx.waitUntil(
    (async () => {
      for (const row of missing.slice(0, MAX_SCREENSHOT_BACKFILL)) {
        try {
          await enrichItemScreenshot(env, row.id);
        } catch (err) {
          console.error("item screenshot failed", row.id, err);
        }
      }
    })(),
  );
}

export function scheduleItemEnrichment(
  ctx: WaitUntilCtx,
  env: Env,
  itemId: string,
): void {
  ctx.waitUntil(
    (async () => {
      try {
        await enrichItem(env, itemId);
      } catch (err) {
        console.error("item enrichment failed", itemId, err);
        try {
          await writeParse(env, itemId, {
            parseStatus: "failed",
            parseError: (err instanceof Error ? err.message : String(err)).slice(
              0,
              500,
            ),
            parsedAt: new Date(),
          });
        } catch (updateErr) {
          console.error(
            "item enrichment status update failed",
            itemId,
            updateErr,
          );
        }
      }
      await embedItem(env, itemId);
    })(),
  );
  ctx.waitUntil(
    enrichItemScreenshot(env, itemId).catch((err) => {
      console.error("item screenshot failed", itemId, err);
    }),
  );
}
