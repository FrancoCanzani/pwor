import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  shader: z.string().trim().min(1).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    shader: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.shader !== undefined,
    { message: "name, description, or shader is required" },
  );
