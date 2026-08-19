import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { markCaptureHintSeen } from "@features/inbox/lib/capture-hint";

type Captured = {
  id: string;
  workspaceId: string | null;
  duplicate?: boolean;
};

export function useCaptureFeedback() {
  const queryClient = useQueryClient();

  const invalidateItems = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
  }, [queryClient]);

  const notifySaved = useCallback((label: string, _items: Captured[]) => {
    markCaptureHintSeen();
    toast.success(`Saved to ${label}`);
  }, []);

  const savedLabel = useCallback(
    (
      items: Captured[],
      fallback: string,
      spaces: { id: string; name: string }[],
    ) => {
      const workspaceId = items.find((item) => item.workspaceId)?.workspaceId;
      if (!workspaceId) return fallback === "File for me" ? "Inbox" : fallback;
      return (
        spaces.find((space) => space.id === workspaceId)?.name.trim() ||
        "Untitled"
      );
    },
    [],
  );

  return { notifySaved, invalidateItems, savedLabel };
}
