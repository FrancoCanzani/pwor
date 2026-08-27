import { z } from "zod";

export const listQuerySchema = z.object({
  spaceId: z.string().optional(),
  inbox: z
    .union([
      z.literal("1"),
      z.literal("true"),
      z.literal("0"),
      z.literal("false"),
    ])
    .optional()
    .transform((value) => value === "1" || value === "true"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const updateItemSchema = z
  .object({
    spaceId: z.string().nullable().optional(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.spaceId !== undefined ||
      value.title !== undefined ||
      value.pinned !== undefined,
    { message: "At least one field is required" },
  );

export const idsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export const batchUpdateItemSchema = idsSchema
  .extend({
    spaceId: z.string().nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (value) => value.spaceId !== undefined || value.pinned !== undefined,
    { message: "spaceId or pinned is required" },
  );

export const captureSchema = z.object({
  input: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  spaceId: z.string().nullable().optional(),
  autoSpace: z.boolean().optional(),
  hint: z.string().trim().max(4000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  preferredSpaceId: z.string().nullable().optional(),
});
