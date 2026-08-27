import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteItem, registerDeleteItems } from "./delete";
import { registerGetItem } from "./get";
import { registerGetAllItems } from "./get-all";
import { registerGetItemFile } from "./get-file";
import { registerGetItemPreview } from "./get-preview";
import { registerGetItemUsage } from "./get-usage";
import { registerGetItemWeb } from "./get-web";
import { registerPostItem } from "./post";
import { registerPatchItems, registerPutItem } from "./put";

const items = new Hono<AppEnv>();

registerGetItemUsage(items);
registerGetAllItems(items);
registerPostItem(items);
registerPatchItems(items);
registerDeleteItems(items);
registerGetItemFile(items);
registerGetItemPreview(items);
registerGetItemWeb(items);
registerGetItem(items);
registerPutItem(items);
registerDeleteItem(items);

export { items };
