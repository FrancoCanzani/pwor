import { z } from "zod";

export const vaultDocumentTypeSchema = z.enum([
  "passport",
  "id",
  "contract",
  "insurance",
  "other",
]);

export const vaultExtractionSchema = z.object({
  documentType: vaultDocumentTypeSchema,
  title: z.string(),
  summary: z.string(),
  issuer: z.string().nullable(),
  holderName: z.string().nullable(),
  documentNumber: z.string().nullable(),
  expiresAt: z.string().nullable(),
  keyDates: z
    .array(z.object({ label: z.string(), date: z.string() }))
    .default([]),
});

export type VaultExtraction = z.infer<typeof vaultExtractionSchema>;
