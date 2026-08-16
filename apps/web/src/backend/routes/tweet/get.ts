import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { TWEET_ID_RE } from "@shared/tweet";
import type { AppEnv } from "../../types";
import { fetchTweet } from "../items/lib/tweet";

export function registerGetTweet(app: Hono<AppEnv>) {
  return app.get("/tweet/:id", async (c) => {
    const id = c.req.param("id");
    if (!TWEET_ID_RE.test(id)) {
      throw new HTTPException(400, { message: "Invalid tweet id" });
    }
    const tweet = await fetchTweet(id);
    if (!tweet) {
      throw new HTTPException(404, { message: "Tweet not found" });
    }
    return c.json(tweet);
  });
}
