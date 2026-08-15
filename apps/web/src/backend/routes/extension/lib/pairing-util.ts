import { z } from "zod";

export const startSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export const pollSchema = z.object({
  pairingId: z.string().min(1),
  secret: z.string().min(1),
});

export const approveSchema = z.object({
  pairingId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
});

export const PAIRING_TTL_MS = 10 * 60 * 1000;

export function appOrigin(env: Env): string {
  return env.BETTER_AUTH_URL.replace(/\/$/, "");
}

export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
