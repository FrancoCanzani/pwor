import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { VaultPage } from "@features/vault/components/vault-page";

const vaultSearchSchema = z.object({
  item: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/_app/$workspaceId/vault/")({
  validateSearch: vaultSearchSchema,
  component: VaultPage,
});
