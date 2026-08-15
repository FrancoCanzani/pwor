import { Hono } from "hono";

import type { AppEnv } from "../../types";
import { registerDeleteItem } from "./delete";
import { registerGetItem } from "./get";
import { registerGetAllItems } from "./get-all";
import { registerGetItemFile } from "./get-file";
import { registerGetItemPreview } from "./get-preview";
import { registerGetItemUsage } from "./get-usage";
import { registerPostItem } from "./post";
import { registerPutItem } from "./put";

const items = new Hono<AppEnv>();

registerGetItemUsage(items);
registerGetAllItems(items);
registerPostItem(items);
registerGetItemFile(items);
registerGetItemPreview(items);
registerGetItem(items);
registerPutItem(items);
registerDeleteItem(items);

export { items };
