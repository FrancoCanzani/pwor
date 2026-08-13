import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SpaceLibraryPage } from "@features/spaces/components/space-library-page";

const spaceSearchSchema = z.object({
  item: z.string().optional(),
});

export const Route = createFileRoute("/_app/$workspaceId/")({
  validateSearch: spaceSearchSchema,
  component: SpaceLibraryPage,
});
