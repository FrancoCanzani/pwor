import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { VaultPage } from "@features/vault/components/vault-page";

/** `?item=` opens viewer; `?category=` / `?type=` / `?uncategorized=` encode nav. */
const vaultSearchSchema = z.object({
  item: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(["links", "docs", "images", "text", "snippets"]).optional(),
  uncategorized: z
    .union([z.literal(true), z.literal("true")])
    .optional()
    .transform((value) => (value ? (true as const) : undefined)),
});

export const Route = createFileRoute("/_app/$workspaceId/vault/")({
  validateSearch: vaultSearchSchema,
  component: VaultPage,
});
