import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteMcpKey } from "./delete";
import { registerGetMcpKeys } from "./get";
import { registerPostMcpKey } from "./post";

const mcpKeys = new Hono<AppEnv>();

registerGetMcpKeys(mcpKeys);
registerPostMcpKey(mcpKeys);
registerDeleteMcpKey(mcpKeys);

export { mcpKeys };
