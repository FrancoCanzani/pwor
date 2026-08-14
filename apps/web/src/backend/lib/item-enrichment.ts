import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import { createDb } from "../db";
import { item } from "../db/schema";
import { fetchPageMetadata, normalizeItemKind } from "./item-capture";
import { extractItemMarkdown } from "./item-markdown";
import { storeSiteScreenshot } from "./item-screenshot";

const ENRICHMENT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Tags are freeform semantic labels, not a fixed taxonomy — prefer concrete nouns (topics, people, places, brands). */
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
  const kind = normalizeItemKind(row.kind);

  if (kind === "link" && row.url) {
    const page = await fetchPageMetadata(row.url);
    const title = page.title || row.title || row.url;
    const siteName = page.siteName ?? row.siteName;
    const summary = page.description ?? row.summary;
    const content =
      [page.description, page.text].filter(Boolean).join("\n\n") ||
      row.content;

    let previewR2Key = row.previewR2Key;
    if (!previewR2Key) {
      try {
        previewR2Key = await storeSiteScreenshot(
          env,
          row.userId,
          itemId,
          row.url,
        );
      } catch (error) {
        console.error("link preview screenshot failed", itemId, error);
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
        ...(previewR2Key ? { previewR2Key } : {}),
      })
      .where(eq(item.id, itemId));

    row = {
      ...row,
      kind: "link",
      title,
      siteName,
      summary,
      content,
      previewR2Key: previewR2Key ?? row.previewR2Key,
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
    row.kind ? `Kind: ${normalizeItemKind(row.kind)}` : null,
    row.language ? `Language: ${row.language}` : null,
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

export function scheduleItemEnrichment(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  itemId: string,
): void {
  ctx.waitUntil(
    enrichItem(env, itemId).catch((err) => {
      console.error("item enrichment failed", itemId, err);
    }),
  );
}
