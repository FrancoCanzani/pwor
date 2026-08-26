import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { user, userInbox } from "../db/schema";
import { randomToken } from "./token";

export const INBOUND_EMAIL_DOMAIN = "inbound.pwor.app";

const RESERVED = new Set([
  "abuse",
  "admin",
  "administrator",
  "bounce",
  "contact",
  "email",
  "help",
  "hostmaster",
  "inbox",
  "info",
  "mail",
  "mailer-daemon",
  "no-reply",
  "noreply",
  "postmaster",
  "root",
  "security",
  "spam",
  "support",
  "webmaster",
  "www",
]);

const WORDS = [
  "amber",
  "atlas",
  "birch",
  "cedar",
  "coral",
  "delta",
  "ember",
  "fern",
  "grove",
  "haven",
  "iris",
  "jade",
  "kelp",
  "lumen",
  "maple",
  "north",
  "olive",
  "pine",
  "quartz",
  "ridge",
  "sage",
  "tide",
  "umbra",
  "vale",
  "willow",
  "zenith",
] as const;

export function inboxAddress(token: string): string {
  return `${token}@${INBOUND_EMAIL_DOMAIN}`;
}

export function inboundTokenFromTo(to: string): string {
  const angle = to.match(/<([^>]+)>/);
  const address = (angle?.[1] ?? to).trim();
  return (address.split("@")[0] ?? "").toLowerCase();
}

export function isLegacyHexToken(token: string): boolean {
  return /^[0-9a-f]{12}$/.test(token);
}

export async function allocateInboxToken(
  db: Db,
  userId: string,
  options?: { rotate?: boolean },
): Promise<string> {
  const [profile] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const base = localPartFromName(profile?.name ?? "");
  const words = shuffled(WORDS);

  const candidates: string[] = [];
  if (base && !options?.rotate) candidates.push(base);
  for (const word of words) {
    candidates.push(base ? `${base}-${word}` : word);
  }
  if (base) {
    candidates.push(`${base}-${randomToken(2)}`);
  } else {
    candidates.push(`${words[0] ?? "maple"}-${randomToken(2)}`);
  }

  for (const token of candidates) {
    if (RESERVED.has(token)) continue;
    if (await tokenTaken(db, token)) continue;
    return token;
  }

  return `mail-${randomToken(3)}`;
}

function localPartFromName(name: string): string | null {
  const parts = name
    .trim()
    .split(/\s+/)
    .map(slugify)
    .filter((part) => part.length >= 2);
  const first = parts[0];
  if (first && !RESERVED.has(first)) return first;
  const full = parts.join("-");
  if (full.length >= 2 && !RESERVED.has(full)) return full;
  return null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

async function tokenTaken(db: Db, token: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userInbox.id })
    .from(userInbox)
    .where(eq(userInbox.token, token))
    .limit(1);
  return Boolean(row);
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomUnit() * (i + 1));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy;
}

function randomUnit(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0]! / 0x1_0000_0000;
}
