import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { VaultPage } from "@features/vault/components/vault-page";

/** `?item=<id>` opens that item's viewer, so a vault item is linkable. */
const vaultSearchSchema = z.object({
  item: z.string().optional(),
});

export const Route = createFileRoute("/_app/$workspaceId/vault/")({
  validateSearch: vaultSearchSchema,
  component: VaultPage,
});
