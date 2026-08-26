import type { Hono } from "hono";

import { ensureUserInbox } from "../../email";
import { inboxAddress } from "../../lib/inbox-address";
import type { AppEnv } from "../../types";

export function registerGetInbox(app: Hono<AppEnv>) {
  return app.get("/", async (c) => {
    const user = c.get("user")!;
    const inbox = await ensureUserInbox(c.env, user.id);
    return c.json({
      address: inboxAddress(inbox.token),
      token: inbox.token,
    });
  });
}
