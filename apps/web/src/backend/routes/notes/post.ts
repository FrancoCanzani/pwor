import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";

import {
  EMPTY_NOTE_BODY,
  inferTitleFromRaw,
  normalizeNoteTitle,
  noteHasBody,
} from "@shared/note-frontmatter";
import { createDb } from "../../db";
import {
  assertOwnedFeedItem,
  assertOwnedItem,
  assertOwnedWorkspace,
} from "../../db/helpers";
import { note } from "../../db/schema";
import { scheduleNoteEmbed } from "../../lib/embed";
import type { AppEnv } from "../../types";
import { serializeNote } from "./lib/serialize";
import { createNoteSchema, titleFromQuote } from "./schemas";

export function registerPostNote(app: Hono<AppEnv>) {
  return app.post("/", zValidator("json", createNoteSchema), async (c) => {
    const user = c.get("user")!;
    const payload = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [, ownedItem] = await Promise.all([
      assertOwnedWorkspace(db, payload.workspaceId, user.id),
      assertOwnedItem(db, payload.itemId, user.id),
      assertOwnedFeedItem(db, payload.feedItemId, user.id),
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
    const workspaceId = payload.workspaceId ?? ownedItem?.workspaceId ?? null;

    const [created] = await db
      .insert(note)
      .values({
        id,
        userId: user.id,
        body,
        title,
        workspaceId,
        itemId: payload.itemId ?? null,
        feedItemId: payload.feedItemId ?? null,
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

    if (created && noteHasBody(created.body)) {
      scheduleNoteEmbed(c.executionCtx, c.env, created.id);
    }

    return c.json(created ? serializeNote(created) : created, 201);
  });
}
