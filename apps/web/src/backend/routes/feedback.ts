import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../types";

const FEEDBACK_FROM = {
  name: "Pwor",
  email: "feedback@pwor.app",
} as const;

const sendFeedbackSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function registerPostFeedback(app: Hono<AppEnv>) {
  return app.post(
    "/feedback",
    zValidator("json", sendFeedbackSchema),
    async (c) => {
      const user = c.get("user")!;
      const { message } = c.req.valid("json");
      const text = `From: ${user.email}\n\n${message}`;

      try {
        await c.env.EMAIL.send({
          to: c.env.FEEDBACK_TO,
          from: FEEDBACK_FROM,
          replyTo: user.email,
          subject: `Feedback from ${user.email}`,
          text,
          html: `<p>From: ${escapeHtml(user.email)}</p><p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`,
        });
      } catch (error) {
        console.error(error);
        throw new HTTPException(502, { message: "Couldn’t send feedback" });
      }

      return c.json({ ok: true as const });
    },
  );
}
