import { generateObject } from "ai";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

import { createDb } from "../db";
import { workspace } from "../db/schema";

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

/**
 * Pick a space for an auto-routed clip (e.g. X bookmark).
 * Prefers keyword overlap; falls back to Workers AI when ambiguous; else newest space.
 */
export async function resolveAutoSpace(
  env: Env,
  userId: string,
  hint: string | null | undefined,
  preferredWorkspaceId?: string | null,
): Promise<string | null> {
  const db = createDb(env.DB);
  const spaces = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
    })
    .from(workspace)
    .where(eq(workspace.userId, userId))
    .orderBy(desc(workspace.updatedAt));

  if (spaces.length === 0) return null;
  if (spaces.length === 1) return spaces[0]!.id;

  const trimmed = hint?.trim() ?? "";
  if (!trimmed) {
    return preferredWorkspaceId &&
      spaces.some((space) => space.id === preferredWorkspaceId)
      ? preferredWorkspaceId
      : spaces[0]!.id;
  }

  const scored = spaces
    .map((space) => {
      const blob = `${space.name} ${space.description ?? ""}`;
      return { id: space.id, score: scoreOverlap(blob, trimmed) };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0]!;
  const second = scored[1];
  if (top.score >= 0.25 && (!second || top.score - second.score >= 0.1)) {
    return top.id;
  }

  try {
    const workersai = createWorkersAI({ binding: env.AI });
    const { object } = await generateObject({
      model: workersai(MODEL),
      schema: z.object({
        workspaceId: z.string(),
      }),
      prompt: `Pick the best Pwor space for this captured content.

Spaces:
${spaces
  .map(
    (space) =>
      `- id=${space.id} name=${JSON.stringify(space.name)} description=${JSON.stringify(space.description ?? "")}`,
  )
  .join("\n")}

Content hint:
${trimmed.slice(0, 2000)}

Return only a workspaceId from the list.`,
    });

    if (spaces.some((space) => space.id === object.workspaceId)) {
      return object.workspaceId;
    }
  } catch (error) {
    console.error("auto-space AI failed", error);
  }

  if (
    preferredWorkspaceId &&
    spaces.some((space) => space.id === preferredWorkspaceId)
  ) {
    return preferredWorkspaceId;
  }

  return spaces[0]!.id;
}
