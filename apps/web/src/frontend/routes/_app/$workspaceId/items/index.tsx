import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ItemPage } from "@features/items/components/item-page";

const itemSearchSchema = z.object({
  item: z.string().optional(),
});

export const Route = createFileRoute("/_app/$workspaceId/items/")({
  validateSearch: itemSearchSchema,
  component: ItemPage,
});
