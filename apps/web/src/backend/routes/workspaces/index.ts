import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteWorkspace } from "./delete";
import { registerGetWorkspace } from "./get";
import { registerGetAllWorkspaces } from "./get-all";
import { registerPostWorkspace } from "./post";
import { registerPutWorkspace } from "./put";

const workspaces = new Hono<AppEnv>();

registerGetAllWorkspaces(workspaces);
registerPostWorkspace(workspaces);
registerGetWorkspace(workspaces);
registerPutWorkspace(workspaces);
registerDeleteWorkspace(workspaces);

export { workspaces };
