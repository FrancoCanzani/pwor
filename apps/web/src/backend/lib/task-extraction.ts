import { generateObject } from "ai";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import type { inboxItem } from "../db/schema";

const TASK_EXTRACTION_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const TASK_EXTRACTION_SYSTEM_PROMPT = `You turn a forwarded email into a single actionable task.

- title: a short, concrete action (imperative, under 80 characters). Not the email subject verbatim unless it already reads as an action.
- dueAt: an ISO 8601 date if the email states or clearly implies a deadline; otherwise null. Never invent a date.`;

const BODY_CHARS = 4000;

const taskExtractionSchema = z.object({
  title: z.string().min(1).max(200),
  dueAt: z.string().nullable(),
});

export type ExtractedTask = z.infer<typeof taskExtractionSchema>;

export async function extractTaskFromEmail(
  env: Env,
  item: Pick<typeof inboxItem.$inferSelect, "fromAddress" | "subject" | "body">,
): Promise<ExtractedTask> {
  const workersai = createWorkersAI({ binding: env.AI });
  const today = new Date().toISOString().slice(0, 10);

  const { object } = await generateObject({
    model: workersai(TASK_EXTRACTION_MODEL),
    schema: taskExtractionSchema,
    system: TASK_EXTRACTION_SYSTEM_PROMPT,
    prompt: `Today is ${today}.
From: ${item.fromAddress}
Subject: ${item.subject?.trim() || "(no subject)"}
Body:
${item.body.slice(0, BODY_CHARS)}`,
  });

  return object;
}
