import { eq } from "drizzle-orm";
import { extractText, getDocumentProxy } from "unpdf";

import type { Db } from "../../../db";
import { vaultItem } from "../../../db/schema";
import {
  EXTRACTION_MODEL,
  EXTRACTION_SYSTEM_PROMPT,
  MIN_PDF_TEXT_LENGTH,
  OCR_MODEL,
} from "./constants";
import { vaultExtractionSchema, type VaultExtraction } from "./schema";

function extractResponseText(result: unknown): string {
  if (result && typeof result === "object" && "response" in result) {
    const value = (result as { response?: unknown }).response;
    if (typeof value === "string") return value;
  }
  return "";
}

async function ocrImage(env: Env, bytes: ArrayBuffer): Promise<string> {
  const result = await env.AI.run(OCR_MODEL, {
    image: Array.from(new Uint8Array(bytes)),
    prompt:
      "Transcribe every piece of text visible in this image, verbatim, preserving line breaks. If there is no legible text, respond with an empty string.",
    max_tokens: 1024,
  });

  const text = extractResponseText(result).trim();
  if (!text) {
    throw new Error("Could not find any legible text in this image");
  }
  return text;
}

async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  const trimmed = text.trim();

  if (trimmed.length < MIN_PDF_TEXT_LENGTH) {
    throw new Error(
      "This PDF has no extractable text layer (likely a scan) — scanned PDFs aren't supported yet",
    );
  }

  return trimmed;
}

export async function extractContent(
  env: Env,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  if (mimeType.startsWith("image/")) return ocrImage(env, bytes);
  if (mimeType === "application/pdf") return extractPdfText(bytes);

  throw new Error(`Unsupported file type: ${mimeType}`);
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
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
  const cleaned = stripCodeFence(raw);
  const preview = raw.slice(0, 200) || "(empty response)";

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Extraction model did not return JSON: "${preview}"`);
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(
        `Extraction model returned malformed JSON: "${preview}"`,
      );
    }
  }

  const validation = vaultExtractionSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `Extraction model's JSON didn't match the expected shape: ${validation.error.issues.map((issue) => issue.message).join(", ")}`,
    );
  }

  return validation.data;
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
  const content = await extractContent(env, bytes, item.mimeType);
  const extraction = await classifyAndExtract(env, content);

  await db
    .update(vaultItem)
    .set({
      status: "ready",
      type: extraction.documentType,
      title: extraction.title,
      ocrText: content,
      extracted: extraction,
      expiresAt: extraction.expiresAt ? new Date(extraction.expiresAt) : null,
      error: null,
    })
    .where(eq(vaultItem.id, itemId));
}

export function toHumanErrorMessage(technicalMessage: string): string {
  if (
    technicalMessage.startsWith("Extraction model did not return JSON") ||
    technicalMessage.startsWith("Extraction model returned malformed JSON") ||
    technicalMessage.startsWith("Extraction model's JSON didn't match")
  ) {
    return "Couldn't read this document. Try again in a moment.";
  }
  if (technicalMessage.includes("no extractable text layer")) {
    return "This PDF looks scanned — we can't read scanned PDFs yet.";
  }
  if (technicalMessage.includes("Could not find any legible text")) {
    return "Couldn't find any readable text in this image.";
  }
  if (technicalMessage.startsWith("Unsupported file type")) {
    return "This file type isn't supported yet.";
  }
  return "Something went wrong processing this file.";
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
