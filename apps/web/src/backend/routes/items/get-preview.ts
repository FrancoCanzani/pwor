import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { item } from "../../db/schema";
import type { AppEnv } from "../../types";

export function registerGetItemPreview(app: Hono<AppEnv>) {
  return app.get("/:id/preview", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select({
        id: item.id,
        previewR2Key: item.previewR2Key,
      })
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row?.previewR2Key) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const object = await c.env.ITEMS_BUCKET.get(row.previewR2Key);
    if (!object) throw new HTTPException(404, { message: "Preview not found" });

    const contentType =
      object.httpMetadata?.contentType ||
      (row.previewR2Key.endsWith(".png")
        ? "image/png"
        : row.previewR2Key.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");

    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}
