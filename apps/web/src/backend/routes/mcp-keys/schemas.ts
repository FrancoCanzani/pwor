import { z } from "zod";

export const createMcpKeySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});
