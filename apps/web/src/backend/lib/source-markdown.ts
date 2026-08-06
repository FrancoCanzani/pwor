import { eq } from "drizzle-orm";

import { createDb } from "../db";
import { source } from "../db/schema";

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
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
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

export function resolveSourceMime(
  filename: string | null | undefined,
  mimeType: string | null | undefined,
): string | null {
  const ext = extensionOf(filename);
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext];
  if (mimeType && SUPPORTED_MIMES.has(mimeType)) return mimeType;
  if (mimeType === "text/plain" || mimeType === "text/markdown") return mimeType;
  return null;
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
    .update(source)
    .set({
      parseStatus: values.parseStatus,
      extractedMarkdown: values.extractedMarkdown ?? null,
      parseError: values.parseError ?? null,
      parsedAt: values.parsedAt ?? null,
    })
    .where(eq(source.id, id));
}

export async function extractSourceMarkdown(
  env: Env,
  sourceId: string,
): Promise<void> {
  const db = createDb(env.DB);
  const [item] = await db
    .select()
    .from(source)
    .where(eq(source.id, sourceId))
    .limit(1);

  if (!item) return;

  if (item.type === "text") {
    const markdown = item.content?.trim() || item.extractedMarkdown || "";
    await markParse(env, sourceId, {
      parseStatus: "ready",
      extractedMarkdown: markdown,
      parseError: null,
      parsedAt: new Date(),
    });
    return;
  }

  if (!item.r2Key) {
    await markParse(env, sourceId, {
      parseStatus: "failed",
      parseError: "missing original object",
      parsedAt: new Date(),
    });
    return;
  }

  const mime = resolveSourceMime(item.filename ?? item.title, item.mimeType);
  // Fetched HTML pages often arrive as text/html without a convertible filename.
  const effectiveMime =
    mime ??
    (item.mimeType?.startsWith("text/html") ? "text/html" : null) ??
    (item.mimeType?.startsWith("text/plain") ? "text/plain" : null);

  if (!effectiveMime) {
    await markParse(env, sourceId, {
      parseStatus: "skipped",
      parseError: "unsupported format for toMarkdown",
      parsedAt: new Date(),
    });
    return;
  }

  if (effectiveMime === "text/plain" || effectiveMime === "text/markdown") {
    const object = await env.VAULT_BUCKET.get(item.r2Key);
    if (!object) {
      await markParse(env, sourceId, {
        parseStatus: "failed",
        parseError: "r2 object missing",
        parsedAt: new Date(),
      });
      return;
    }
    const text = await object.text();
    await markParse(env, sourceId, {
      parseStatus: "ready",
      extractedMarkdown: text,
      parseError: null,
      parsedAt: new Date(),
    });
    return;
  }

  const object = await env.VAULT_BUCKET.get(item.r2Key);
  if (!object) {
    await markParse(env, sourceId, {
      parseStatus: "failed",
      parseError: "r2 object missing",
      parsedAt: new Date(),
    });
    return;
  }

  const buffer = await object.arrayBuffer();
  const filename =
    item.filename?.trim() ||
    item.title?.trim() ||
    `document.${extensionOf(item.filename ?? item.title) ?? (effectiveMime === "text/html" ? "html" : "bin")}`;

  try {
    const result = await env.AI.toMarkdown(
      {
        name: filename,
        blob: new Blob([new Uint8Array(buffer)], { type: effectiveMime }),
      },
      {
        conversionOptions: {
          pdf: { metadata: false },
        },
      },
    );

    if (result.format === "error") {
      await markParse(env, sourceId, {
        parseStatus: "failed",
        parseError: result.error || "toMarkdown error",
        parsedAt: new Date(),
      });
      return;
    }

    await markParse(env, sourceId, {
      parseStatus: "ready",
      extractedMarkdown: result.data,
      parseError: null,
      parsedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markParse(env, sourceId, {
      parseStatus: "failed",
      parseError: message.slice(0, 500),
      parsedAt: new Date(),
    });
  }
}

export function scheduleSourceMarkdownExtraction(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  sourceId: string,
): void {
  ctx.waitUntil(
    extractSourceMarkdown(env, sourceId).catch((err) => {
      console.error("source markdown extraction failed", sourceId, err);
    }),
  );
}
