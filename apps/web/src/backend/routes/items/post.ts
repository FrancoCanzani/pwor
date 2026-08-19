import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Context, Hono } from "hono";

import { createDb } from "../../db";
import { assertOwnedWorkspace } from "../../db/helpers";
import { item } from "../../db/schema";
import type { AppEnv } from "../../types";
import { isGeneratedAudioFilename } from "@shared/audio";
import { resolveAutoSpace } from "./lib/auto-space";
import {
  normalizeSeedTags,
  normalizeUrl,
  parseCaptureInput,
  titleFromText,
} from "./lib/capture";
import { scheduleItemEnrichment } from "./lib/enrichment";
import { serializeItem } from "./lib/serialize";
import { putItemObject } from "./lib/storage";
import { captureSchema } from "./schemas";

const MAX_ITEM_FILE_BYTES = 50 * 1024 * 1024;
const MAX_POSTER_BYTES = 2 * 1024 * 1024;

function posterExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpg";
  return null;
}

async function createFromFile(c: Context<AppEnv>) {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const file = body.file;
  const workspaceId =
    typeof body.workspaceId === "string" ? body.workspaceId : null;
  const titleOverride =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 200)
      : null;

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "file is required" });
  }
  if (file.size === 0) {
    throw new HTTPException(400, { message: "file is empty" });
  }
  if (file.size > MAX_ITEM_FILE_BYTES) {
    throw new HTTPException(413, { message: "File too large (max 50MB)" });
  }

  const db = createDb(c.env.DB);
  await assertOwnedWorkspace(db, workspaceId, user.id);

  const id = crypto.randomUUID();
  const contentType = file.type || "application/octet-stream";
  const r2Key = `${user.id}/${id}/${file.name}`;
  const sizeBytes = await putItemObject(
    c.env.ITEMS_BUCKET,
    r2Key,
    await file.arrayBuffer(),
    contentType,
  );

  let previewR2Key: string | undefined;
  const poster = body.poster;
  if (
    contentType.startsWith("video/") &&
    poster instanceof File &&
    poster.size > 0 &&
    poster.size <= MAX_POSTER_BYTES
  ) {
    const ext = posterExtension(poster.type);
    if (ext) {
      previewR2Key = `${user.id}/${id}/preview.${ext}`;
      await putItemObject(
        c.env.ITEMS_BUCKET,
        previewR2Key,
        await poster.arrayBuffer(),
        poster.type,
      );
    }
  }

  const [created] = await db
    .insert(item)
    .values({
      id,
      userId: user.id,
      kind: "file",
      title:
        titleOverride ??
        (contentType.startsWith("audio/") && isGeneratedAudioFilename(file.name)
          ? null
          : file.name),
      r2Key,
      sizeBytes,
      mimeType: contentType,
      workspaceId,
      parseStatus: "pending",
      ...(previewR2Key ? { previewR2Key } : {}),
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create item" });
  }

  scheduleItemEnrichment(c.executionCtx, c.env, id);
  return c.json(serializeItem(created), 201);
}

async function createFromCapture(c: Context<AppEnv>) {
  const user = c.get("user")!;
  const payload = captureSchema.parse(await c.req.json());
  const {
    input,
    title,
    workspaceId,
    autoSpace,
    hint,
    tags,
    preferredWorkspaceId,
  } = payload;
  const db = createDb(c.env.DB);

  let workspace = workspaceId ?? null;
  await assertOwnedWorkspace(db, workspace, user.id);
  if (workspace == null && autoSpace) {
    workspace = await resolveAutoSpace(
      c.env,
      user.id,
      hint ?? input,
      preferredWorkspaceId,
    );
  }

  const parsed = parseCaptureInput(input);
  const id = crypto.randomUUID();
  const seedTags = normalizeSeedTags(tags);

  if (parsed.type === "url") {
    const normalized = normalizeUrl(parsed.url);
    const [existing] = normalized
      ? await db
          .select()
          .from(item)
          .where(
            and(eq(item.userId, user.id), eq(item.normalizedUrl, normalized)),
          )
          .limit(1)
      : [];

    if (existing) {
      const mergedTags = seedTags
        ? Array.from(new Set([...(existing.tags ?? []), ...seedTags]))
        : existing.tags;
      const nextWorkspace =
        existing.workspaceId == null && workspace != null
          ? workspace
          : existing.workspaceId;

      if (
        mergedTags !== existing.tags ||
        nextWorkspace !== existing.workspaceId
      ) {
        const [merged] = await db
          .update(item)
          .set({ tags: mergedTags, workspaceId: nextWorkspace })
          .where(eq(item.id, existing.id))
          .returning();
        if (!merged) {
          throw new HTTPException(404, { message: "Item not found" });
        }
        return c.json({ ...serializeItem(merged), duplicate: true }, 200);
      }

      return c.json({ ...serializeItem(existing), duplicate: true }, 200);
    }

    const [created] = await db
      .insert(item)
      .values({
        id,
        userId: user.id,
        kind: "link",
        title: title || parsed.url,
        url: parsed.url,
        normalizedUrl: normalized,
        tags: seedTags,
        workspaceId: workspace,
        parseStatus: "pending",
      })
      .returning();

    if (!created) {
      throw new HTTPException(500, { message: "Failed to create item" });
    }

    scheduleItemEnrichment(c.executionCtx, c.env, id);
    return c.json(serializeItem(created), 201);
  }

  const encoded = new TextEncoder().encode(parsed.content);
  const [created] = await db
    .insert(item)
    .values({
      id,
      userId: user.id,
      kind: "text",
      title: title || titleFromText(parsed.content),
      content: parsed.content,
      sizeBytes: encoded.byteLength,
      tags: seedTags,
      workspaceId: workspace,
      parseStatus: "pending",
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create item" });
  }

  scheduleItemEnrichment(c.executionCtx, c.env, id);
  return c.json(serializeItem(created), 201);
}

export function registerPostItem(app: Hono<AppEnv>) {
  return app.post("/", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return createFromFile(c);
    }
    return createFromCapture(c);
  });
}
