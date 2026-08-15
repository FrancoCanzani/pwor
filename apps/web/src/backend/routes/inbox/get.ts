import type { Hono } from "hono";

import { ensureUserInbox } from "../../email";
import type { AppEnv } from "../../types";

const INBOUND_EMAIL_DOMAIN = "inbound.pwor.app";

export function registerGetInbox(app: Hono<AppEnv>) {
  return app.get("/", async (c) => {
    const user = c.get("user")!;
    const inbox = await ensureUserInbox(c.env, user.id);
    return c.json({
      address: `${inbox.token}@${INBOUND_EMAIL_DOMAIN}`,
      token: inbox.token,
    });
  });
}
