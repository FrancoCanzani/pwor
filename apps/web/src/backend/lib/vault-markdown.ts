import { eq } from "drizzle-orm";

import { createDb } from "../db";
import { vaultItem } from "../db/schema";

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
    .update(vaultItem)
    .set({
      parseStatus: values.parseStatus,
      extractedMarkdown: values.extractedMarkdown ?? null,
      parseError: values.parseError ?? null,
      parsedAt: values.parsedAt ?? null,
    })
    .where(eq(vaultItem.id, id));
}

export async function extractVaultItemMarkdown(
  env: Env,
  vaultItemId: string,
): Promise<void> {
  const db = createDb(env.DB);
  const [item] = await db
    .select()
    .from(vaultItem)
    .where(eq(vaultItem.id, vaultItemId))
    .limit(1);

  if (!item || item.kind !== "file" || !item.r2Key) {
    await markParse(env, vaultItemId, {
      parseStatus: "skipped",
      parseError: "not a vault file",
      parsedAt: new Date(),
    });
    return;
  }

  const mime = resolveMime(item.title, item.mimeType);
  if (!mime) {
    await markParse(env, vaultItemId, {
      parseStatus: "skipped",
      parseError: "unsupported format for toMarkdown",
      parsedAt: new Date(),
    });
    return;
  }

  const object = await env.VAULT_BUCKET.get(item.r2Key);
  if (!object) {
    await markParse(env, vaultItemId, {
      parseStatus: "failed",
      parseError: "r2 object missing",
      parsedAt: new Date(),
    });
    return;
  }

  const buffer = await object.arrayBuffer();
  const filename = item.title?.trim() || `document.${extensionOf(item.title) ?? "bin"}`;

  try {
    const result = await env.AI.toMarkdown(
      {
        name: filename,
        blob: new Blob([new Uint8Array(buffer)], { type: mime }),
      },
      {
        conversionOptions: {
          pdf: { metadata: false },
        },
      },
    );

    if (result.format === "error") {
      await markParse(env, vaultItemId, {
        parseStatus: "failed",
        parseError: result.error || "toMarkdown error",
        parsedAt: new Date(),
      });
      return;
    }

    await markParse(env, vaultItemId, {
      parseStatus: "ready",
      extractedMarkdown: result.data,
      parseError: null,
      parsedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markParse(env, vaultItemId, {
      parseStatus: "failed",
      parseError: message.slice(0, 500),
      parsedAt: new Date(),
    });
  }
}

export function scheduleVaultMarkdownExtraction(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  vaultItemId: string,
): void {
  ctx.waitUntil(
    extractVaultItemMarkdown(env, vaultItemId).catch((err) => {
      console.error("vault markdown extraction failed", vaultItemId, err);
    }),
  );
}
