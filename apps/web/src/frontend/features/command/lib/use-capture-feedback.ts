import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { AUTO_DESTINATION_LABEL } from "@features/command/lib/capture";

type Captured = {
  id: string;
  spaceId: string | null;
  duplicate?: boolean;
};

export function useCaptureFeedback() {
  const queryClient = useQueryClient();

  const invalidateItems = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
  }, [queryClient]);

  const notifySaved = useCallback((label: string, _items: Captured[]) => {
    toast.success(`Saved to ${label}`);
  }, []);

  const savedLabel = useCallback(
    (
      items: Captured[],
      fallback: string,
      spaces: { id: string; name: string }[],
    ) => {
      const spaceId = items.find((item) => item.spaceId)?.spaceId;
      if (!spaceId) {
        return fallback === AUTO_DESTINATION_LABEL ? "Inbox" : fallback;
      }
      return (
        spaces.find((space) => space.id === spaceId)?.name.trim() || "Untitled"
      );
    },
    [],
  );

  return { notifySaved, invalidateItems, savedLabel };
}
