import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { feed } from "../../db/schema";
import type { AppEnv } from "../../types";
import { resolveFeedUrl } from "./lib/discover";
import { syncFeed } from "./lib/sync";
import { createFeedSchema } from "./schemas";

export function registerPostFeed(app: Hono<AppEnv>) {
  return app.post("/", zValidator("json", createFeedSchema), async (c) => {
    const user = c.get("user")!;
    const { url } = c.req.valid("json");
    const db = createDb(c.env.DB);

    let resolved: { feedUrl: string; youtube: boolean };
    try {
      resolved = await resolveFeedUrl(url);
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error ? error.message : "Could not resolve feed",
      });
    }

    const [existing] = await db
      .select({ id: feed.id })
      .from(feed)
      .where(and(eq(feed.userId, user.id), eq(feed.url, resolved.feedUrl)))
      .limit(1);

    if (existing) {
      throw new HTTPException(409, { message: "Already subscribed" });
    }

    const id = crypto.randomUUID();
    await db.insert(feed).values({
      id,
      userId: user.id,
      url: resolved.feedUrl,
      kind: resolved.youtube ? "youtube" : "rss",
      title: resolved.feedUrl,
    });

    try {
      await syncFeed(c.env, id, user.id);
    } catch (error) {
      console.error("initial feed sync failed", error);
    }

    const [created] = await db
      .select()
      .from(feed)
      .where(ownedBy(feed.id, id, feed.userId, user.id))
      .limit(1);

    return c.json(created!, 201);
  });
}
