import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

import { createDb } from "../../../db";
import { assertOwnedSpace } from "../../../db/helpers";
import { item } from "../../../db/schema";
import type { WaitUntilCtx } from "../../../types";
import { resolveAutoSpace } from "./auto-space";
import {
  normalizeSeedTags,
  normalizeUrl,
  parseCaptureInput,
  titleFromText,
} from "./capture";
import { scheduleItemEnrichment } from "./enrichment";
import { captureSchema } from "../schemas";

type CapturePayload = z.infer<typeof captureSchema>;

export type PendingItemValues = {
  id?: string;
  userId: string;
  spaceId: string | null;
  tags?: string[] | null;
} & (
  | {
      kind: "link";
      title: string;
      url: string;
      normalizedUrl: string | null;
    }
  | {
      kind: "text";
      title: string;
      content: string;
      sizeBytes: number;
    }
  | {
      kind: "file";
      title: string;
      r2Key: string;
      sizeBytes: number;
      mimeType: string;
      previewR2Key?: string;
    }
);

export async function insertPendingItem(
  env: Env,
  ctx: WaitUntilCtx,
  values: PendingItemValues,
) {
  const db = createDb(env.DB);
  const id = values.id ?? crypto.randomUUID();
  const [created] = await db
    .insert(item)
    .values({
      id,
      userId: values.userId,
      spaceId: values.spaceId,
      tags: values.tags ?? null,
      parseStatus: "pending",
      ...(values.kind === "link"
        ? {
            kind: "link" as const,
            title: values.title,
            url: values.url,
            normalizedUrl: values.normalizedUrl,
          }
        : values.kind === "text"
          ? {
              kind: "text" as const,
              title: values.title,
              content: values.content,
              sizeBytes: values.sizeBytes,
            }
          : {
              kind: "file" as const,
              title: values.title,
              r2Key: values.r2Key,
              sizeBytes: values.sizeBytes,
              mimeType: values.mimeType,
              ...(values.previewR2Key
                ? { previewR2Key: values.previewR2Key }
                : {}),
            }),
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create item" });
  }

  scheduleItemEnrichment(ctx, env, id);
  return created;
}

export async function createCapturedItem(
  env: Env,
  ctx: WaitUntilCtx,
  userId: string,
  payload: CapturePayload,
) {
  const { input, title, spaceId, autoSpace, hint, tags, preferredSpaceId } =
    payload;
  const db = createDb(env.DB);

  let destSpaceId = spaceId ?? null;
  await assertOwnedSpace(db, destSpaceId, userId);
  if (destSpaceId == null && autoSpace) {
    destSpaceId = await resolveAutoSpace(
      env,
      userId,
      hint ?? input,
      preferredSpaceId,
    );
  }

  const parsed = parseCaptureInput(input);
  const seedTags = normalizeSeedTags(tags);

  if (parsed.type === "url") {
    const normalized = normalizeUrl(parsed.url);
    const [existing] = normalized
      ? await db
          .select()
          .from(item)
          .where(
            and(eq(item.userId, userId), eq(item.normalizedUrl, normalized)),
          )
          .limit(1)
      : [];

    if (existing) {
      const mergedTags = seedTags
        ? Array.from(new Set([...(existing.tags ?? []), ...seedTags]))
        : existing.tags;
      const nextSpace =
        existing.spaceId == null && destSpaceId != null
          ? destSpaceId
          : existing.spaceId;

      if (mergedTags !== existing.tags || nextSpace !== existing.spaceId) {
        const [merged] = await db
          .update(item)
          .set({ tags: mergedTags, spaceId: nextSpace })
          .where(eq(item.id, existing.id))
          .returning();
        if (!merged) {
          throw new HTTPException(404, { message: "Item not found" });
        }
        return { row: merged, duplicate: true as const };
      }

      return { row: existing, duplicate: true as const };
    }

    const row = await insertPendingItem(env, ctx, {
      userId,
      kind: "link",
      title: title || parsed.url,
      url: parsed.url,
      normalizedUrl: normalized,
      tags: seedTags,
      spaceId: destSpaceId,
    });
    return { row, duplicate: false as const };
  }

  const encoded = new TextEncoder().encode(parsed.content);
  const row = await insertPendingItem(env, ctx, {
    userId,
    kind: "text",
    title: title || titleFromText(parsed.content),
    content: parsed.content,
    sizeBytes: encoded.byteLength,
    tags: seedTags,
    spaceId: destSpaceId,
  });
  return { row, duplicate: false as const };
}
