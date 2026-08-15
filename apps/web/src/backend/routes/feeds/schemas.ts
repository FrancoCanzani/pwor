import { z } from "zod";

export const createFeedSchema = z.object({
  url: z.string().trim().min(1).max(2000),
});

export const listFeedItemsSchema = z.object({
  feedId: z.string().optional(),
  unread: z
    .union([
      z.literal("1"),
      z.literal("true"),
      z.literal("0"),
      z.literal("false"),
    ])
    .optional()
    .transform((value) => value === "1" || value === "true"),
  q: z.string().trim().max(200).optional(),
});

// `%` / `_` are LIKE wildcards — escape so the term matches literally.
export function likePattern(term: string): string {
  return `%${term.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
}
