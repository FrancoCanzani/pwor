import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteFeed } from "./delete";
import { registerGetAllFeeds } from "./get-all";
import { registerGetFeedItem } from "./get-item";
import { registerGetFeedItems } from "./get-items";
import { registerPostFeed } from "./post";
import { registerPostFeedItemRead } from "./post-item-read";
import { registerPostFeedsSync } from "./post-sync";
import { registerPostFeedSync } from "./post-sync-one";

const feeds = new Hono<AppEnv>();

registerGetAllFeeds(feeds);
registerPostFeed(feeds);
registerPostFeedsSync(feeds);
registerGetFeedItems(feeds);
registerGetFeedItem(feeds);
registerPostFeedItemRead(feeds);
registerPostFeedSync(feeds);
registerDeleteFeed(feeds);

export { feeds };
