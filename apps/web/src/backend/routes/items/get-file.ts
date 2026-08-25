import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { item } from "../../db/schema";
import type { AppEnv } from "../../types";

export function registerGetItemFile(app: Hono<AppEnv>) {
  return app.get("/:id/file", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select()
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row || !row.r2Key || !row.mimeType) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const object = await c.env.ITEMS_BUCKET.get(row.r2Key);
    if (!object) throw new HTTPException(404, { message: "File not found" });

    // Uploaded markup must never render on the app origin (stored XSS).
    const inlineSafe =
      /^(image|video)\//.test(row.mimeType) ||
      row.mimeType === "application/pdf" ||
      row.mimeType === "text/plain";
    const filename = row.r2Key.slice(row.r2Key.lastIndexOf("/") + 1);

    return new Response(object.body, {
      headers: {
        "Content-Type": row.mimeType,
        ...(inlineSafe
          ? {}
          : {
              "Content-Disposition": `attachment; filename="${filename.replace(/["\\]/g, "_")}"`,
            }),
      },
    });
  });
}
