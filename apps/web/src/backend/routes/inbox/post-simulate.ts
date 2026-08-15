import type { Hono } from "hono";

import { ensureUserInbox, handleInboundEmail } from "../../email";
import type { AppEnv } from "../../types";

const INBOUND_EMAIL_DOMAIN = "inbound.pwor.app";

export function registerPostInboxSimulate(app: Hono<AppEnv>) {
  return app.post("/simulate", async (c) => {
    const isLocal =
      c.env.BETTER_AUTH_URL.includes("localhost") ||
      c.env.BETTER_AUTH_URL.includes("127.0.0.1");
    if (!isLocal) {
      return c.json({ error: "Not available" }, 404);
    }

    const user = c.get("user")!;
    const inbox = await ensureUserInbox(c.env, user.id);
    const raw = `From: Alex <alex@example.com>
To: ${inbox.token}@${INBOUND_EMAIL_DOMAIN}
Subject: Contract renewal needed by Friday
Content-Type: multipart/mixed; boundary="sim"
MIME-Version: 1.0

--sim
Content-Type: text/plain; charset="utf-8"

Hi,

Can you send the renewed contract paperwork over by this Friday? We need it signed before month end.

Thanks,
Alex
--sim
Content-Type: text/plain; name="notes.txt"
Content-Disposition: attachment; filename="notes.txt"

Renewal terms attached.
--sim--
`;

    await handleInboundEmail(
      {
        to: `${inbox.token}@${INBOUND_EMAIL_DOMAIN}`,
        from: "alex@example.com",
        raw: new Blob([raw]).stream(),
        setReject: () => {},
      },
      c.env,
      c.executionCtx,
    );
    return c.json({ ok: true });
  });
}
