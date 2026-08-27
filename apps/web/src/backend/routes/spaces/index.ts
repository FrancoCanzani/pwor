import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteSpace } from "./delete";
import { registerGetSpace } from "./get";
import { registerGetAllSpaces } from "./get-all";
import { registerPostSpace } from "./post";
import { registerPutSpace } from "./put";

const spaces = new Hono<AppEnv>();

registerGetAllSpaces(spaces);
registerPostSpace(spaces);
registerGetSpace(spaces);
registerPutSpace(spaces);
registerDeleteSpace(spaces);

export { spaces };
