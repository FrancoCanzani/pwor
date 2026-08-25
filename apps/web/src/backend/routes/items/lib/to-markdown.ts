import { eq } from "drizzle-orm";

import { createDb } from "../../../db";
import { item } from "../../../db/schema";

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  bmp: "image/bmp",
  html: "text/html",
  htm: "text/html",
  xml: "application/xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroenabled.12",
  xlsb: "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  csv: "text/csv",
  numbers: "application/vnd.apple.numbers",
};

const SUPPORTED_MIMES = new Set(Object.values(EXTENSION_MIME));

function extensionOf(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const base = filename.split("/").pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  return base.slice(dot + 1).toLowerCase();
}

function resolveMime(
  filename: string | null | undefined,
  mimeType: string | null | undefined,
): string | null {
  const ext = extensionOf(filename);
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext];
  if (mimeType && SUPPORTED_MIMES.has(mimeType)) return mimeType;
  return null;
}

export async function markdownFromFile(
  env: Env,
  file: { name: string; blob: Blob },
  conversionOptions?: { pdf?: { metadata: boolean } },
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  try {
    const result = conversionOptions
      ? await env.AI.toMarkdown(file, { conversionOptions })
      : await env.AI.toMarkdown(file);
    if (result.format === "error") {
      return { ok: false, error: result.error || "toMarkdown error" };
    }
    return { ok: true, data: result.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.slice(0, 500) };
  }
}

async function markParse(
  env: Env,
  id: string,
  values: {
    parseStatus: "pending" | "ready" | "failed" | "skipped";
    extractedMarkdown?: string | null;
    parseError?: string | null;
    parsedAt?: Date | null;
  },
): Promise<void> {
  const db = createDb(env.DB);
  await db
    .update(item)
    .set({
      parseStatus: values.parseStatus,
      extractedMarkdown: values.extractedMarkdown ?? null,
      parseError: values.parseError ?? null,
      parsedAt: values.parsedAt ?? null,
    })
    .where(eq(item.id, id));
}

export async function extractItemMarkdown(
  env: Env,
  itemId: string,
): Promise<void> {
  const db = createDb(env.DB);
  const [row] = await db
    .select()
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (!row || row.kind !== "file" || !row.r2Key) {
    await markParse(env, itemId, {
      parseStatus: "skipped",
      parseError: "not a file item",
      parsedAt: new Date(),
    });
    return;
  }

  const object = await env.ITEMS_BUCKET.get(row.r2Key);
  if (!object) {
    await markParse(env, itemId, {
      parseStatus: "failed",
      parseError: "r2 object missing",
      parsedAt: new Date(),
    });
    return;
  }

  const buffer = await object.arrayBuffer();

  const mime = resolveMime(row.title, row.mimeType);
  if (!mime) {
    await markParse(env, itemId, {
      parseStatus: "skipped",
      parseError: "unsupported format for toMarkdown",
      parsedAt: new Date(),
    });
    return;
  }

  const filename = row.title?.trim() || `document.${extensionOf(row.title) ?? "bin"}`;

  const converted = await markdownFromFile(
    env,
    {
      name: filename,
      blob: new Blob([new Uint8Array(buffer)], { type: mime }),
    },
    { pdf: { metadata: false } },
  );

  if (!converted.ok) {
    await markParse(env, itemId, {
      parseStatus: "failed",
      parseError: converted.error,
      parsedAt: new Date(),
    });
    return;
  }

  await markParse(env, itemId, {
    parseStatus: "ready",
    extractedMarkdown: converted.data,
    parseError: null,
    parsedAt: new Date(),
  });
}
