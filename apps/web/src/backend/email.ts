import { eq } from "drizzle-orm";
import PostalMime, { type Attachment } from "postal-mime";

import { createDb } from "./db";
import { inboxItem, task, vaultItem, workspaceInbox } from "./db/schema";
import { extractTaskFromEmail } from "./lib/task-extraction";

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

export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<void> {
  const token = message.to.split("@")[0] ?? "";
  const db = createDb(env.DB);

  const [inbox] = await db
    .select()
    .from(workspaceInbox)
    .where(eq(workspaceInbox.token, token))
    .limit(1);

  if (!inbox) {
    message.setReject("Unknown address");
    return;
  }

  const raw = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(raw);

  const inboxItemId = crypto.randomUUID();
  const fromAddress = message.from;
  const subject = parsed.subject?.trim() || null;
  const body = parsed.text || parsed.html || "";

  await db.insert(inboxItem).values({
    id: inboxItemId,
    userId: inbox.userId,
    workspaceId: inbox.workspaceId,
    fromAddress,
    subject,
    body,
  });

  for (const attachment of parsed.attachments) {
    const id = crypto.randomUUID();
    const filename = attachment.filename || "attachment";
    const r2Key = `${inbox.userId}/${id}/${filename}`;

    await env.VAULT_BUCKET.put(r2Key, attachmentBytes(attachment), {
      httpMetadata: {
        contentType: attachment.mimeType || "application/octet-stream",
      },
    });

    await db.insert(vaultItem).values({
      id,
      userId: inbox.userId,
      workspaceId: inbox.workspaceId,
      inboxItemId: inboxItemId,
      kind: "file",
      title: filename,
      r2Key,
      mimeType: attachment.mimeType || "application/octet-stream",
    });
  }

  try {
    const extracted = await extractTaskFromEmail(env, {
      fromAddress,
      subject,
      body,
    });

    await db.insert(task).values({
      id: crypto.randomUUID(),
      userId: inbox.userId,
      workspaceId: inbox.workspaceId,
      title: extracted.title,
      dueAt: extracted.dueAt ? new Date(extracted.dueAt) : null,
      sourceType: "inbox_item",
      sourceId: inboxItemId,
    });
  } catch {
    // Best-effort — the inbox item is captured either way; a task can
    // still be generated manually from the Inbox sheet.
  }
}
