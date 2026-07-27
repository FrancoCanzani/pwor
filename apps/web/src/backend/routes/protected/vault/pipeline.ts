import { eq } from "drizzle-orm";

import type { Db } from "../../../db";
import { vaultItem } from "../../../db/schema";
import { vaultExtractionSchema, type VaultExtraction } from "./schema";

const OCR_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const EXTRACTION_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const EXTRACTION_SYSTEM_PROMPT = `You classify and extract structured data from personal documents (passports, IDs, contracts, insurance policies, and other paperwork).
Respond with valid JSON only, matching exactly this shape, no markdown, no commentary:
{
  "documentType": "passport" | "id" | "contract" | "insurance" | "other",
  "title": string,
  "summary": string (one sentence),
  "issuer": string | null,
  "holderName": string | null,
  "documentNumber": string | null,
  "expiresAt": string | null (ISO date YYYY-MM-DD, the document's expiry or renewal date, if any),
  "keyDates": [{ "label": string, "date": string (ISO date) }]
}
If a field doesn't apply or isn't present in the text, use null (or [] for keyDates). Never invent values.`;

function extractResponseText(result: unknown): string {
  if (result && typeof result === "object" && "response" in result) {
    const value = (result as { response?: unknown }).response;
    if (typeof value === "string") return value;
  }
  return "";
}

export async function ocrExtract(
  env: Env,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<string | null> {
  if (!mimeType.startsWith("image/")) return null;

  const result = await env.AI.run(OCR_MODEL, {
    image: Array.from(new Uint8Array(bytes)),
    prompt:
      "Transcribe every piece of text visible in this image, verbatim, preserving line breaks. If there is no legible text, respond with an empty string.",
    max_tokens: 1024,
  });

  const text = extractResponseText(result);
  return text.trim() || null;
}

export async function classifyAndExtract(
  env: Env,
  content: string,
): Promise<VaultExtraction> {
  const result = await env.AI.run(EXTRACTION_MODEL, {
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    temperature: 0,
    max_tokens: 512,
  });

  const raw = extractResponseText(result);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Extraction model did not return JSON");
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);
  return vaultExtractionSchema.parse(parsed);
}

export async function processVaultItem(
  env: Env,
  db: Db,
  itemId: string,
): Promise<void> {
  const [item] = await db
    .select()
    .from(vaultItem)
    .where(eq(vaultItem.id, itemId))
    .limit(1);

  if (!item) {
    throw new Error(`vault item ${itemId} not found`);
  }

  await db
    .update(vaultItem)
    .set({ status: "processing" })
    .where(eq(vaultItem.id, itemId));

  const object = await env.VAULT_BUCKET.get(item.r2Key);
  if (!object) {
    throw new Error(`r2 object missing for key ${item.r2Key}`);
  }

  const bytes = await object.arrayBuffer();
  const ocrText = await ocrExtract(env, bytes, item.mimeType);
  const content =
    ocrText && ocrText.length > 0
      ? ocrText
      : `File name: ${item.title ?? item.r2Key}`;

  const extraction = await classifyAndExtract(env, content);

  await db
    .update(vaultItem)
    .set({
      status: "ready",
      type: extraction.documentType,
      title: extraction.title,
      ocrText,
      extracted: extraction,
      expiresAt: extraction.expiresAt ? new Date(extraction.expiresAt) : null,
      error: null,
    })
    .where(eq(vaultItem.id, itemId));
}

export async function markVaultItemFailed(
  db: Db,
  itemId: string,
  error: string,
): Promise<void> {
  await db
    .update(vaultItem)
    .set({ status: "failed", error })
    .where(eq(vaultItem.id, itemId));
}
