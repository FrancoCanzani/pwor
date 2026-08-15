import type { Hono } from "hono";

import { regenerateUserInbox } from "../../email";
import type { AppEnv } from "../../types";

const INBOUND_EMAIL_DOMAIN = "inbound.pwor.app";

export function registerPostInboxRegenerate(app: Hono<AppEnv>) {
  return app.post("/regenerate", async (c) => {
    const user = c.get("user")!;
    const inbox = await regenerateUserInbox(c.env, user.id);
    return c.json({
      address: `${inbox.token}@${INBOUND_EMAIL_DOMAIN}`,
      token: inbox.token,
    });
  });
}
