import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerGetInbox } from "./get";
import { registerPostInboxRegenerate } from "./post-regenerate";
import { registerPostInboxSimulate } from "./post-simulate";

const inbox = new Hono<AppEnv>();

registerGetInbox(inbox);
registerPostInboxRegenerate(inbox);
registerPostInboxSimulate(inbox);

export { inbox };
