import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerGetSearch } from "./get";

const search = new Hono<AppEnv>();
registerGetSearch(search);
export { search };
