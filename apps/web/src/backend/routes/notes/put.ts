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
import { ownedBy, assertOwnedWorkspace } from "../../db/helpers";
import { note } from "../../db/schema";
import { scheduleNoteEmbed } from "../../lib/embed";
import type { AppEnv } from "../../types";
import { updateNoteSchema } from "./schemas";

export function registerPutNote(app: Hono<AppEnv>) {
  return app.patch("/:id", zValidator("json", updateNoteSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { body, title, workspaceId, expectedUpdatedAt } = c.req.valid("json");
    const db = createDb(c.env.DB);

    await assertOwnedWorkspace(db, workspaceId, user.id);

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
      ...(workspaceId !== undefined ? { workspaceId } : {}),
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
        return c.json(updated);
      }

      const [existing] = await db
        .select()
        .from(note)
        .where(ownedBy(note.id, id, note.userId, user.id))
        .limit(1);
      if (!existing) throw new HTTPException(404, { message: "Not found" });
      return c.json({ error: "conflict", note: existing }, 409);
    }

    const [updated] = await db
      .update(note)
      .set(patch)
      .where(ownedBy(note.id, id, note.userId, user.id))
      .returning();

    if (!updated) throw new HTTPException(404, { message: "Not found" });

    return c.json(updated);
  });
}
