import { z } from "zod";

export const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
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
    workspaceId: z.string().nullable().optional(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.workspaceId !== undefined ||
      value.title !== undefined ||
      value.pinned !== undefined,
    { message: "At least one field is required" },
  );

export const captureSchema = z.object({
  input: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  workspaceId: z.string().nullable().optional(),
  autoSpace: z.boolean().optional(),
  hint: z.string().trim().max(4000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  preferredWorkspaceId: z.string().nullable().optional(),
});
