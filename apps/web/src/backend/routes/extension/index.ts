import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteDevice } from "./delete-device";
import { registerGetDevices } from "./get-devices";
import { registerPostLinkApprove } from "./post-link-approve";
import { registerPostLinkPoll } from "./post-link-poll";
import { registerPostLinkStart } from "./post-link-start";

const extension = new Hono<AppEnv>();

registerPostLinkStart(extension);
registerPostLinkPoll(extension);
registerPostLinkApprove(extension);
registerGetDevices(extension);
registerDeleteDevice(extension);

export { extension };
