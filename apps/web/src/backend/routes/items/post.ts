import { HTTPException } from "hono/http-exception";
import type { Context, Hono } from "hono";

import { createDb } from "../../db";
import { assertOwnedSpace } from "../../db/helpers";
import type { AppEnv } from "../../types";
import { createCapturedItem, insertPendingItem } from "./lib/create";
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
  const spaceId =
    typeof body.spaceId === "string" ? body.spaceId : null;
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
  await assertOwnedSpace(db, spaceId, user.id);

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

  const created = await insertPendingItem(c.env, c.executionCtx, {
    id,
    userId: user.id,
    kind: "file",
    title: titleOverride ?? file.name,
    r2Key,
    sizeBytes,
    mimeType: contentType,
    spaceId,
    previewR2Key,
  });
  return c.json(serializeItem(created), 201);
}

async function createFromCapture(c: Context<AppEnv>) {
  const user = c.get("user")!;
  const payload = captureSchema.parse(await c.req.json());
  const result = await createCapturedItem(
    c.env,
    c.executionCtx,
    user.id,
    payload,
  );
  const body = serializeItem(result.row);
  if (result.duplicate) {
    return c.json({ ...body, duplicate: true }, 200);
  }
  return c.json(body, 201);
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
