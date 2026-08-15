import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { noteImage } from "../../db/schema";
import type { AppEnv } from "../../types";

export function registerGetNoteImage(app: Hono<AppEnv>) {
  return app.get("/images/:imageId", async (c) => {
    const user = c.get("user")!;
    const imageId = c.req.param("imageId");
    const db = createDb(c.env.DB);

    const [image] = await db
      .select()
      .from(noteImage)
      .where(ownedBy(noteImage.id, imageId, noteImage.userId, user.id))
      .limit(1);

    if (!image) throw new HTTPException(404, { message: "Not found" });

    const object = await c.env.ITEMS_BUCKET.get(image.r2Key);
    if (!object) throw new HTTPException(404, { message: "File not found" });

    return new Response(object.body, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  });
}
