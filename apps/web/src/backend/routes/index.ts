import { Hono } from "hono";

import type { AppEnv } from "../types";
import { extension } from "./extension";
import { feeds } from "./feeds";
import { registerGetHealth } from "./health";
import { inbox } from "./inbox";
import { items } from "./items";
import { mcpKeys } from "./mcp-keys";
import { registerGetMe } from "./me";
import { notes } from "./notes";
import { search } from "./search";
import { spaces } from "./spaces";
import { registerGetTweet } from "./tweet/get";

const api = new Hono<AppEnv>();

registerGetMe(api);
registerGetTweet(api);
api.route("/feeds", feeds);
api.route("/inbox", inbox);
api.route("/notes", notes);
api.route("/search", search);
api.route("/items", items);
api.route("/spaces", spaces);
api.route("/mcp", mcpKeys);

export { api, extension, registerGetHealth };
