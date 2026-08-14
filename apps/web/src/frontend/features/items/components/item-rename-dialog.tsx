import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { renameItem, type Item } from "@features/items/api";

export function ItemRenameDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const queryClient = useQueryClient();

  const rename = useMutation({
    mutationFn: (value: string) => renameItem(item.id, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn’t rename"),
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || rename.isPending) return;
    rename.mutate(trimmed);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setTitle(item.title ?? "");
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-xs">
        <DialogTitle className="sr-only">Rename</DialogTitle>
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-7 text-xs"
            disabled={rename.isPending}
          />
          <Button
            type="submit"
            size="xs"
            disabled={!title.trim() || rename.isPending}
          >
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
