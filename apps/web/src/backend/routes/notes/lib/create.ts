import {
  EMPTY_NOTE_BODY,
  inferTitleFromRaw,
  normalizeNoteTitle,
  noteHasBody,
} from "@shared/note-frontmatter";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

import { createDb } from "../../../db";
import { assertOwnedItem, assertOwnedSpace } from "../../../db/helpers";
import { note } from "../../../db/schema";
import { scheduleNoteEmbed } from "../../../lib/embed";
import type { WaitUntilCtx } from "../../../types";
import { serializeNote } from "./serialize";
import { createNoteSchema, titleFromQuote } from "../schemas";

type CreateNotePayload = z.infer<typeof createNoteSchema>;

export async function createNote(
  env: Env,
  ctx: WaitUntilCtx,
  userId: string,
  payload: CreateNotePayload,
) {
  const db = createDb(env.DB);

  const [, ownedItem] = await Promise.all([
    assertOwnedSpace(db, payload.spaceId, userId),
    assertOwnedItem(db, payload.itemId, userId),
  ]);

  const id = crypto.randomUUID();
  const body =
    payload.body.trim().length > 0 ? payload.body : EMPTY_NOTE_BODY;
  const title =
    (payload.title !== undefined
      ? normalizeNoteTitle(payload.title)
      : undefined) ??
    (payload.anchor
      ? titleFromQuote(payload.anchor.quote)
      : normalizeNoteTitle(inferTitleFromRaw(body).title)) ??
    null;
  const spaceId = payload.spaceId ?? ownedItem?.spaceId ?? null;

  const [created] = await db
    .insert(note)
    .values({
      id,
      userId,
      body,
      title,
      spaceId,
      itemId: payload.itemId ?? null,
      ...(payload.anchor
        ? {
            anchorFrom: payload.anchor.from,
            anchorTo: payload.anchor.to,
            anchorQuote: payload.anchor.quote,
            anchorPrefix: payload.anchor.prefix,
            anchorSuffix: payload.anchor.suffix,
          }
        : {}),
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create note" });
  }

  if (noteHasBody(created.body)) {
    scheduleNoteEmbed(ctx, env, created.id);
  }

  return serializeNote(created);
}
