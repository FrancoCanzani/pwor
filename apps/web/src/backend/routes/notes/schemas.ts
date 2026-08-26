import { z } from "zod";

export const listQuerySchema = z
  .object({
    workspaceId: z.string().optional(),
    itemId: z.string().optional(),
    feedItemId: z.string().optional(),
  })
  .refine((value) => !(value.itemId && value.feedItemId), {
    message: "itemId and feedItemId are mutually exclusive",
  });

const anchorSchema = z.object({
  from: z.number().int(),
  to: z.number().int(),
  quote: z.string().min(1).max(6000),
  prefix: z.string().max(200),
  suffix: z.string().max(200),
});

export const createNoteSchema = z
  .object({
    body: z.string().optional().default(""),
    title: z.string().nullable().optional(),
    workspaceId: z.string().nullable().optional(),
    itemId: z.string().nullable().optional(),
    feedItemId: z.string().nullable().optional(),
    anchor: anchorSchema.optional(),
  })
  .refine((value) => !(value.itemId && value.feedItemId), {
    message: "itemId and feedItemId are mutually exclusive",
  })
  .refine(
    (value) => !value.anchor || Boolean(value.itemId || value.feedItemId),
    { message: "anchor requires itemId or feedItemId" },
  )
  .refine(
    (value) => !(value.itemId || value.feedItemId) || Boolean(value.anchor),
    { message: "itemId or feedItemId requires an anchor" },
  );

export const updateNoteSchema = z
  .object({
    body: z.string().optional(),
    title: z.string().nullable().optional(),
    workspaceId: z.string().nullable().optional(),
    pinned: z.boolean().optional(),
    expectedUpdatedAt: z.union([z.string(), z.number()]).optional(),
  })
  .refine(
    (value) =>
      value.body !== undefined ||
      value.title !== undefined ||
      value.workspaceId !== undefined ||
      value.pinned !== undefined,
    { message: "body, title, workspaceId, or pinned is required" },
  )
  .refine(
    (value) => {
      const touchesContent =
        value.body !== undefined || value.title !== undefined;
      return !touchesContent || value.expectedUpdatedAt !== undefined;
    },
    {
      message: "expectedUpdatedAt is required when updating body or title",
    },
  );

export function titleFromQuote(quote: string): string {
  const compact = quote.replace(/\s+/g, " ").trim();
  if (compact.length <= 80) return compact;
  return `${compact.slice(0, 79).trimEnd()}…`;
}
