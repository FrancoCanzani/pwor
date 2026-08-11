import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import { createDb } from "../db";
import { vaultItem } from "../db/schema";
import { fetchPageMetadata, normalizeVaultKind } from "./vault-capture";
import { extractVaultItemMarkdown } from "./vault-markdown";

const ENRICHMENT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * AI tags are freeform semantic labels — not a fixed taxonomy.
 * Prefer concrete nouns: topics, people, places, brands, themes.
 * Examples: tokyo, product design, hiring, react, fundraising.
 */
const ENRICHMENT_SYSTEM_PROMPT = `You enrich a saved vault item for later search and recall.

Return:
- title: short plain title (under 80 chars). Prefer page title when present. Never invent brands you weren't given.
- summary: 1–2 sentences on what this is and why it matters. Neutral tone.
- tags: 3–8 short lowercase tags (1–3 words each). Topics, entities, places, brands, themes — not generic filler like "link", "interesting", "article", or the media type.`;

const enrichmentSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).min(1).max(8),
});

const BODY_CHARS = 6_000;

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag.slice(0, 40));
    if (out.length >= 8) break;
  }
  return out;
}

export async function enrichVaultItem(
  env: Env,
  vaultItemId: string,
): Promise<void> {
  const db = createDb(env.DB);
  const [initial] = await db
    .select()
    .from(vaultItem)
    .where(eq(vaultItem.id, vaultItemId))
    .limit(1);

  if (!initial) return;

  let item = initial;
  const kind = normalizeVaultKind(item.kind);

  if (kind === "link" && item.url) {
    const page = await fetchPageMetadata(item.url);
    const title = page.title || item.title || item.url;
    const siteName = page.siteName ?? item.siteName;
    const summary = page.description ?? item.summary;
    const content =
      [page.description, page.text].filter(Boolean).join("\n\n") ||
      item.content;

    await db
      .update(vaultItem)
      .set({
        kind: "link",
        title,
        siteName,
        summary,
        content,
      })
      .where(eq(vaultItem.id, vaultItemId));

    item = {
      ...item,
      kind: "link",
      title,
      siteName,
      summary,
      content,
    };
  }

  if (kind === "file" && item.r2Key && !item.extractedMarkdown) {
    await extractVaultItemMarkdown(env, vaultItemId);
    const [refreshed] = await db
      .select()
      .from(vaultItem)
      .where(eq(vaultItem.id, vaultItemId))
      .limit(1);
    if (!refreshed) return;
    item = refreshed;
  }

  const bodyParts = [
    item.title ? `Title: ${item.title}` : null,
    item.url ? `URL: ${item.url}` : null,
    item.siteName ? `Site: ${item.siteName}` : null,
    item.kind ? `Kind: ${normalizeVaultKind(item.kind)}` : null,
    item.content ? `Content:\n${item.content.slice(0, BODY_CHARS)}` : null,
    item.extractedMarkdown
      ? `Extracted:\n${item.extractedMarkdown.slice(0, BODY_CHARS)}`
      : null,
    item.summary ? `Existing summary: ${item.summary}` : null,
  ].filter(Boolean);

  if (bodyParts.length === 0) {
    await db
      .update(vaultItem)
      .set({
        parseStatus: "skipped",
        parseError: "nothing to enrich",
        parsedAt: new Date(),
      })
      .where(eq(vaultItem.id, vaultItemId));
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

    const tags = normalizeTags(object.tags);

    await db
      .update(vaultItem)
      .set({
        title: object.title.trim() || item.title,
        summary: object.summary.trim(),
        tags,
        kind,
        parseStatus: "ready",
        parseError: null,
        parsedAt: new Date(),
      })
      .where(eq(vaultItem.id, vaultItemId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(vaultItem)
      .set({
        parseStatus: "failed",
        parseError: message.slice(0, 500),
        parsedAt: new Date(),
      })
      .where(eq(vaultItem.id, vaultItemId));
  }
}

export function scheduleVaultEnrichment(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  vaultItemId: string,
): void {
  ctx.waitUntil(
    enrichVaultItem(env, vaultItemId).catch((err) => {
      console.error("vault enrichment failed", vaultItemId, err);
    }),
  );
}
