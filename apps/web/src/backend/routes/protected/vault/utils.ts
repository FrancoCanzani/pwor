import encodePng, { init as initPngEncoder } from "@jsquash/png/encode";
import { generateObject, NoObjectGeneratedError } from "ai";
import { eq } from "drizzle-orm";
import { extractImages, extractText, getDocumentProxy } from "unpdf";
import { createWorkersAI } from "workers-ai-provider";

import type { Db } from "../../../db";
import { vaultItem } from "../../../db/schema";
import PNG_ENCODER_WASM from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
import {
  EXTRACTION_MODEL,
  EXTRACTION_SYSTEM_PROMPT,
  MAX_OCR_PDF_PAGES,
  MIN_PDF_TEXT_LENGTH,
  OCR_MODEL,
  PDF_OCR_CONCURRENCY,
} from "./constants";
import { vaultExtractionSchema, type VaultExtraction } from "./schema";

export type VaultErrorCode =
  | "no_ocr_text"
  | "scanned_pdf"
  | "unsupported_type"
  | "bad_json";

export class VaultProcessingError extends Error {
  code: VaultErrorCode;

  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

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
    throw new VaultProcessingError(
      "no_ocr_text",
      "Could not find any legible text in this image",
    );
  }
  return text;
}

let pngEncoderReady: Promise<unknown> | undefined;

function ensurePngEncoderReady(): Promise<unknown> {
  pngEncoderReady ??= initPngEncoder(PNG_ENCODER_WASM);
  return pngEncoderReady;
}

/** Expands 1/3/4-channel raw pixel data into the flat RGBA buffer the PNG encoder expects. */
function toRgba(image: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: 1 | 3 | 4;
}): Uint8ClampedArray<ArrayBuffer> {
  const { data, width, height, channels } = image;
  const rgba = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));

  for (let i = 0; i < width * height; i++) {
    if (channels === 4) {
      rgba[i * 4] = data[i * 4] ?? 0;
      rgba[i * 4 + 1] = data[i * 4 + 1] ?? 0;
      rgba[i * 4 + 2] = data[i * 4 + 2] ?? 0;
      rgba[i * 4 + 3] = data[i * 4 + 3] ?? 0;
    } else if (channels === 3) {
      rgba[i * 4] = data[i * 3] ?? 0;
      rgba[i * 4 + 1] = data[i * 3 + 1] ?? 0;
      rgba[i * 4 + 2] = data[i * 3 + 2] ?? 0;
      rgba[i * 4 + 3] = 255;
    } else {
      const value = data[i] ?? 0;
      rgba[i * 4] = value;
      rgba[i * 4 + 1] = value;
      rgba[i * 4 + 2] = value;
      rgba[i * 4 + 3] = 255;
    }
  }

  return rgba;
}

/**
 * Scanned PDF pages are almost always a single full-page photo embedded as an
 * image XObject, so pulling the embedded image out is a cheap stand-in for
 * actually rendering the page (which needs a canvas backend unavailable in
 * Workers).
 */
async function extractPageImagePng(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  pageNumber: number,
): Promise<ArrayBuffer | null> {
  const images = await extractImages(pdf, pageNumber);
  if (images.length === 0) return null;

  const largest = images.reduce((a, b) =>
    a.width * a.height >= b.width * b.height ? a : b,
  );

  await ensurePngEncoderReady();
  return encodePng({
    data: toRgba(largest),
    width: largest.width,
    height: largest.height,
    colorSpace: "srgb",
  });
}

async function ocrScannedPdfPages(
  env: Env,
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
): Promise<string> {
  const pageCount = Math.min(pdf.numPages, MAX_OCR_PDF_PAGES);
  const pageTexts: string[] = new Array(pageCount).fill("");

  let nextPage = 1;
  async function worker() {
    for (;;) {
      const pageNumber = nextPage++;
      if (pageNumber > pageCount) return;

      const png = await extractPageImagePng(pdf, pageNumber);
      if (!png) continue;

      try {
        pageTexts[pageNumber - 1] = await ocrImage(env, png);
      } catch {
        // No legible text on this page — leave it blank and move on.
      }
    }
  }

  await Promise.all(
    Array.from({ length: PDF_OCR_CONCURRENCY }, () => worker()),
  );

  const combined = pageTexts
    .filter(Boolean)
    .join("\n\n---\n\n")
    .trim();

  if (!combined) {
    throw new VaultProcessingError(
      "scanned_pdf",
      "This PDF looks scanned and no legible text could be found on any page",
    );
  }

  return combined;
}

async function extractPdfText(env: Env, bytes: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  const trimmed = text.trim();

  if (trimmed.length >= MIN_PDF_TEXT_LENGTH) {
    return trimmed;
  }

  return ocrScannedPdfPages(env, pdf);
}

export async function extractContent(
  env: Env,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  if (mimeType.startsWith("image/")) return ocrImage(env, bytes);
  if (mimeType === "application/pdf") return extractPdfText(env, bytes);

  throw new VaultProcessingError(
    "unsupported_type",
    `Unsupported file type: ${mimeType}`,
  );
}

/**
 * Long runs of a repeated character (redaction bars, "xxxxx" placeholders,
 * "----" separators) can send small/fast instruct models into a degenerate
 * empty completion. Collapsing them keeps the signal and drops the noise.
 */
function collapseRepeatedRuns(text: string): string {
  return text.replace(/(.)\1{4,}/g, "$1$1$1");
}

export async function classifyAndExtract(
  env: Env,
  content: string,
): Promise<VaultExtraction> {
  const workersai = createWorkersAI({ binding: env.AI });

  try {
    const { object } = await generateObject({
      model: workersai(EXTRACTION_MODEL),
      schema: vaultExtractionSchema,
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: collapseRepeatedRuns(content),
      temperature: 0,
    });

    return object;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new VaultProcessingError(
        "bad_json",
        `Extraction model did not return usable JSON: ${error.message}`,
      );
    }
    throw error;
  }
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
  if (!item.r2Key || !item.mimeType) {
    throw new Error(`vault item ${itemId} has no file to process`);
  }
  const r2Key = item.r2Key;
  const mimeType = item.mimeType;

  await db
    .update(vaultItem)
    .set({ status: "processing" })
    .where(eq(vaultItem.id, itemId));

  const object = await env.VAULT_BUCKET.get(r2Key);
  if (!object) {
    throw new Error(`r2 object missing for key ${r2Key}`);
  }

  const bytes = await object.arrayBuffer();
  const content = await extractContent(env, bytes, mimeType);
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

const HUMAN_ERROR_MESSAGE: Record<VaultErrorCode, string> = {
  no_ocr_text: "Couldn't find any readable text in this image.",
  scanned_pdf: "Couldn't find any readable text in this scanned PDF.",
  unsupported_type: "This file type isn't supported yet.",
  bad_json: "Couldn't read this document. Try again in a moment.",
};

export function toHumanErrorMessage(error: unknown): string {
  if (error instanceof VaultProcessingError) {
    return HUMAN_ERROR_MESSAGE[error.code];
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
