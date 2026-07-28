import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";

import { createDb } from "./db";
import { vaultItem } from "./db/schema";
import { createAuth } from "./lib/auth";
import { authMiddleware, requireAuth } from "./middleware/auth";
import protectedRoutes from "./routes/protected";
import { cleanupOrphanNoteImages } from "./routes/protected/notes/cleanup";
import {
  markVaultItemFailed,
  processVaultItem,
  toHumanErrorMessage,
} from "./routes/protected/vault/utils";
import publicRoutes from "./routes/public";
import type { AppEnv } from "./types";

const REMINDER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_QUEUE_ATTEMPTS = 3;

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", secureHeaders());

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.use("*", authMiddleware);

app.on(["GET", "POST"], "/api/auth/*", (c) =>
  createAuth(c.env).handler(c.req.raw),
);

app.route("/", publicRoutes);

app.use("/api/*", requireAuth);
app.route("/api", protectedRoutes);

export default {
  fetch: app.fetch,

  async queue(
    batch: MessageBatch<{ itemId: string }>,
    env: Env,
  ): Promise<void> {
    const db = createDb(env.DB);

    await Promise.allSettled(
      batch.messages.map(async (msg) => {
        try {
          await processVaultItem(env, db, msg.body.itemId);
          msg.ack();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            `vault item ${msg.body.itemId} processing failed (attempt ${msg.attempts})`,
            message,
          );
          await markVaultItemFailed(
            db,
            msg.body.itemId,
            toHumanErrorMessage(error),
          );

          if (msg.attempts >= MAX_QUEUE_ATTEMPTS) {
            msg.ack();
          } else {
            msg.retry({ delaySeconds: 30 * 2 ** msg.attempts });
          }
        }
      }),
    );
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const db = createDb(env.DB);
    const cutoff = new Date(Date.now() + REMINDER_WINDOW_MS);

    const runReminderScan = async () => {
      const items = await db
        .select()
        .from(vaultItem)
        .where(
          and(
            eq(vaultItem.status, "ready"),
            isNotNull(vaultItem.expiresAt),
            lte(vaultItem.expiresAt, cutoff),
            isNull(vaultItem.remindedAt),
          ),
        );

      await Promise.all(
        items.map((item) => {
          console.log(
            `[reminder] vault item ${item.id} (${item.title}) expires ${item.expiresAt?.toISOString()}`,
          );
          return db
            .update(vaultItem)
            .set({ remindedAt: new Date() })
            .where(eq(vaultItem.id, item.id));
        }),
      );
    };

    await Promise.all([runReminderScan(), cleanupOrphanNoteImages(env)]);
  },
};
