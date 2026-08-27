import { generateObject } from "ai";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import { createDb } from "../../../db";
import { space } from "../../../db/schema";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

function scoreOverlap(haystack: string, needle: string): number {
  const words = needle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  if (words.length === 0) return 0;
  const target = haystack.toLowerCase();
  let hits = 0;
  for (const word of words) {
    if (target.includes(word)) hits += 1;
  }
  return hits / words.length;
}

function pickPreferredOrInbox(
  spaces: Array<{ id: string }>,
  preferredSpaceId?: string | null,
): string | null {
  if (
    preferredSpaceId &&
    spaces.some((row) => row.id === preferredSpaceId)
  ) {
    return preferredSpaceId;
  }
  return null;
}

export async function resolveAutoSpace(
  env: Env,
  userId: string,
  hint: string | null | undefined,
  preferredSpaceId?: string | null,
): Promise<string | null> {
  const db = createDb(env.DB);
  const spaces = await db
    .select({
      id: space.id,
      name: space.name,
      description: space.description,
    })
    .from(space)
    .where(eq(space.userId, userId))
    .orderBy(desc(space.updatedAt));

  if (spaces.length === 0) return null;
  if (spaces.length === 1) return spaces[0]!.id;

  const trimmed = hint?.trim() ?? "";
  if (!trimmed) {
    return pickPreferredOrInbox(spaces, preferredSpaceId);
  }

  const scored = spaces
    .map((row) => {
      const blob = `${row.name} ${row.description ?? ""}`;
      return { id: row.id, score: scoreOverlap(blob, trimmed) };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0]!;
  const second = scored[1];
  if (top.score >= 0.35 && (!second || top.score - second.score >= 0.15)) {
    return top.id;
  }

  try {
    const workersai = createWorkersAI({ binding: env.AI });
    const { object } = await generateObject({
      model: workersai(MODEL),
      schema: z.object({
        spaceId: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      prompt: `Pick the best Pwor space for this captured content.
Only choose a space if you are reasonably confident it fits.
If unsure, still return a spaceId but set confidence below 0.55 so the item stays in Inbox.

Spaces:
${spaces
  .map(
    (row) =>
      `- id=${row.id} name=${JSON.stringify(row.name)} description=${JSON.stringify(row.description ?? "")}`,
  )
  .join("\n")}

Content hint:
${trimmed.slice(0, 2000)}`,
    });

    if (
      object.confidence >= 0.55 &&
      spaces.some((row) => row.id === object.spaceId)
    ) {
      return object.spaceId;
    }
  } catch (error) {
    console.error("auto-space AI failed", error);
  }

  return pickPreferredOrInbox(spaces, preferredSpaceId);
}
