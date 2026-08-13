import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createFeed, type Feed } from "@features/feeds/api";

export function AddFeedDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (feed: Feed) => void;
}) {
  const [url, setUrl] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) setUrl("");
  }, [open]);

  const create = useMutation({
    mutationFn: () => createFeed(url.trim()),
    onSuccess: async (feed) => {
      await queryClient.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Feed added");
      onOpenChange(false);
      onCreated?.(feed);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn’t add feed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!url.trim() || create.isPending) return;
            create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add feed</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Paste a site, RSS/Atom URL, or YouTube channel.
          </p>
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className="h-8 text-xs"
            disabled={create.isPending}
          />
          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || create.isPending}>
              {create.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
