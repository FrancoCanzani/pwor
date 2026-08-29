import { z } from "zod";

export const librarySearchSchema = z.object({
  item: z.string().optional(),
});
