import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, magicLink } from "better-auth/plugins";

import { createDb } from "../db";
import * as schema from "../db/schema";

export const EXTENSION_API_KEY_PREFIX = "pwor_";

/** Default extension key lifetime: 1 year (revocable anytime). */
export const EXTENSION_API_KEY_TTL_SECONDS = 60 * 60 * 24 * 365;

export function createAuth(env: Env) {
  const appOrigin = env.BETTER_AUTH_URL.replace(/\/$/, "");

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(createDb(env.DB), {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: { enabled: false },
    // chrome-extension://* for local WXT builds; lock to the store ID in prod.
    trustedOrigins: [
      appOrigin,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "chrome-extension://*",
      "moz-extension://*",
    ],
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.log(`Magic link for ${email}: ${url}`);
        },
      }),
      bearer(),
      apiKey({
        defaultPrefix: EXTENSION_API_KEY_PREFIX,
        enableSessionForAPIKeys: true,
        enableMetadata: true,
        apiKeyHeaders: ["x-api-key"],
        rateLimit: {
          enabled: true,
          timeWindow: 60_000,
          maxRequests: 120,
        },
      }),
    ],
  });
}
