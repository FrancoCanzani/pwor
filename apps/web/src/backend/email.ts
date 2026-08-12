import { eq } from "drizzle-orm";
import PostalMime, { type Attachment } from "postal-mime";

import { createDb } from "./db";
import { userInbox, vaultItem } from "./db/schema";
import { scheduleVaultEnrichment } from "./lib/vault-enrichment";
import { putVaultObject } from "./lib/vault-storage";
import { titleFromText } from "./lib/vault-capture";

function attachmentBytes(
  attachment: Attachment,
): ArrayBuffer | Uint8Array | string {
  if (
    typeof attachment.content === "string" &&
    attachment.encoding === "base64"
  ) {
    const binary = atob(attachment.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return attachment.content;
}

function newInboxToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function ensureUserInbox(
  env: Env,
  userId: string,
): Promise<{ id: string; token: string }> {
  const db = createDb(env.DB);
  const [existing] = await db
    .select({ id: userInbox.id, token: userInbox.token })
    .from(userInbox)
    .where(eq(userInbox.userId, userId))
    .limit(1);

  if (existing) return existing;

  const id = crypto.randomUUID();
  const token = newInboxToken();
  await db.insert(userInbox).values({ id, userId, token });
  return { id, token };
}

export async function regenerateUserInbox(
  env: Env,
  userId: string,
): Promise<{ id: string; token: string }> {
  const db = createDb(env.DB);
  const token = newInboxToken();
  const [existing] = await db
    .select({ id: userInbox.id })
    .from(userInbox)
    .where(eq(userInbox.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userInbox)
      .set({ token })
      .where(eq(userInbox.id, existing.id));
    return { id: existing.id, token };
  }

  const id = crypto.randomUUID();
  await db.insert(userInbox).values({ id, userId, token });
  return { id, token };
}

/** Inbound mail for `{token}@…` lands in that user's Inbox (uncategorized vault). */
export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: { waitUntil(promise: Promise<unknown>): void },
): Promise<void> {
  const token = message.to.split("@")[0] ?? "";
  const db = createDb(env.DB);

  const [inbox] = await db
    .select()
    .from(userInbox)
    .where(eq(userInbox.token, token))
    .limit(1);

  if (!inbox) {
    message.setReject("Unknown address");
    return;
  }

  const raw = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(raw);

  const fromAddress = message.from;
  const subject = parsed.subject?.trim() || null;
  const body = (parsed.text || parsed.html || "").trim();
  const contentParts = [
    subject ? `Subject: ${subject}` : null,
    `From: ${fromAddress}`,
    "",
    body || "(empty)",
  ].filter((part): part is string => part !== null);
  const content = contentParts.join("\n");

  const textId = crypto.randomUUID();
  await db.insert(vaultItem).values({
    id: textId,
    userId: inbox.userId,
    workspaceId: null,
    kind: "text",
    title: subject || titleFromText(body) || "Email",
    content,
    tags: ["email"],
    parseStatus: "pending",
  });
  scheduleVaultEnrichment(ctx, env, textId);

  for (const attachment of parsed.attachments) {
    const id = crypto.randomUUID();
    const filename = attachment.filename || "attachment";
    const r2Key = `${inbox.userId}/${id}/${filename}`;

    await putVaultObject(
      env.VAULT_BUCKET,
      r2Key,
      attachmentBytes(attachment),
      attachment.mimeType || "application/octet-stream",
    );

    await db.insert(vaultItem).values({
      id,
      userId: inbox.userId,
      workspaceId: null,
      kind: "file",
      title: filename,
      r2Key,
      mimeType: attachment.mimeType || "application/octet-stream",
      tags: ["email"],
      parseStatus: "pending",
    });

    scheduleVaultEnrichment(ctx, env, id);
  }
}
