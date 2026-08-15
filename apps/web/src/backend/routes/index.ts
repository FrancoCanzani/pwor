import { Hono } from "hono";

import type { AppEnv } from "../types";
import { extension } from "./extension";
import { feeds } from "./feeds";
import { registerGetHealth } from "./health";
import { inbox } from "./inbox";
import { items } from "./items";
import { registerGetMe } from "./me";
import { notes } from "./notes";
import { search } from "./search";
import { workspaces } from "./workspaces";

const api = new Hono<AppEnv>();

registerGetMe(api);
api.route("/feeds", feeds);
api.route("/inbox", inbox);
api.route("/notes", notes);
api.route("/search", search);
api.route("/items", items);
api.route("/workspaces", workspaces);

export { api, extension, registerGetHealth };
