import type { Hono } from "hono";

import { regenerateUserInbox } from "../../email";
import { inboxAddress } from "../../lib/inbox-address";
import type { AppEnv } from "../../types";

export function registerPostInboxRegenerate(app: Hono<AppEnv>) {
  return app.post("/regenerate", async (c) => {
    const user = c.get("user")!;
    const inbox = await regenerateUserInbox(c.env, user.id);
    return c.json({
      address: inboxAddress(inbox.token),
      token: inbox.token,
    });
  });
}
