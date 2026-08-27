import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import {
  inferTitleFromRaw,
  normalizeNoteTitle,
} from "@shared/note-frontmatter";
import { toEpochMs } from "@shared/time";
import { createDb } from "../../db";
import { ownedBy, assertOwnedSpace } from "../../db/helpers";
import { note } from "../../db/schema";
import { scheduleNoteEmbed } from "../../lib/embed";
import type { AppEnv } from "../../types";
import { patchOwnedNotes } from "./lib/mutate";
import { serializeNote } from "./lib/serialize";
import { batchUpdateNoteSchema, updateNoteSchema } from "./schemas";

export function registerPatchNotes(app: Hono<AppEnv>) {
  return app.patch("/", zValidator("json", batchUpdateNoteSchema), async (c) => {
    const user = c.get("user")!;
    const { ids, spaceId, pinned } = c.req.valid("json");
    const items = await patchOwnedNotes(c.env, user.id, ids, {
      spaceId,
      pinned,
    });
    return c.json({ items });
  });
}

export function registerPutNote(app: Hono<AppEnv>) {
  return app.patch("/:id", zValidator("json", updateNoteSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { body, title, spaceId, pinned, expectedUpdatedAt } =
      c.req.valid("json");
    const db = createDb(c.env.DB);

    await assertOwnedSpace(db, spaceId, user.id);

    let normalizedTitle: string | null | undefined;
    if (title !== undefined) {
      normalizedTitle = normalizeNoteTitle(title);
    }
    if (body !== undefined && normalizedTitle === undefined) {
      const inferred = normalizeNoteTitle(inferTitleFromRaw(body).title);
      if (inferred) normalizedTitle = inferred;
    }
    const touchesContent = body !== undefined || title !== undefined;
    const patch = {
      ...(body !== undefined ? { body } : {}),
      ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
      ...(spaceId !== undefined ? { spaceId } : {}),
      ...(pinned !== undefined
        ? { pinnedAt: pinned ? new Date() : null }
        : {}),
      ...(touchesContent ? { embedStatus: "pending" as const } : {}),
      updatedAt: new Date(),
    };
    if (touchesContent) {
      const expectedMs = toEpochMs(expectedUpdatedAt!);
      if (Number.isNaN(expectedMs)) {
        throw new HTTPException(400, { message: "Invalid expectedUpdatedAt" });
      }

      const [updated] = await db
        .update(note)
        .set(patch)
        .where(
          and(
            ownedBy(note.id, id, note.userId, user.id),
            eq(note.updatedAt, new Date(expectedMs)),
          ),
        )
        .returning();

      if (updated) {
        scheduleNoteEmbed(c.executionCtx, c.env, updated.id);
        return c.json(serializeNote(updated));
      }

      const [existing] = await db
        .select()
        .from(note)
        .where(ownedBy(note.id, id, note.userId, user.id))
        .limit(1);
      if (!existing) throw new HTTPException(404, { message: "Not found" });
      return c.json({ error: "conflict", note: serializeNote(existing) }, 409);
    }

    const [updated] = await db
      .update(note)
      .set(patch)
      .where(ownedBy(note.id, id, note.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });

    return c.json(serializeNote(updated));
  });
}
