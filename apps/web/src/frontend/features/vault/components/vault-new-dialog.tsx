import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useRef, useState, type SubmitEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  captureVaultInput,
  uploadVaultItem,
} from "@features/vault/api";

export function VaultNewButton({
  categoryId,
}: {
  categoryId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="new"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        New
      </Button>
      <VaultNewDialog
        open={open}
        onOpenChange={setOpen}
        categoryId={categoryId}
      />
    </>
  );
}

export function VaultNewDialog({
  open,
  onOpenChange,
  categoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId?: string | null;
}) {
  const [input, setInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  const capture = useMutation({
    mutationFn: () =>
      captureVaultInput(input.trim(), workspaceId, categoryId ?? null),
    onSuccess: () => {
      toast.success("Added to Vault — parsing…");
      setInput("");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
    },
    onError: () => toast.error("Couldn’t add to Vault"),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    try {
      await Promise.all(
        list.map(async (file) => {
          const toastId = toast.loading(`Uploading ${file.name}…`);
          try {
            await uploadVaultItem(file, workspaceId, categoryId ?? null);
            toast.success(`${file.name} added to Vault`, { id: toastId });
          } catch {
            toast.error(`Failed to upload ${file.name}`, { id: toastId });
          }
        }),
      );
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || capture.isPending) return;
    capture.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setInput("");
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a link, tweet, or any text…"
            className="min-h-32 resize-none text-sm"
            disabled={capture.isPending}
          />
          <p className="text-xs text-muted-foreground">
            AI will classify it, summarize, and tag topics for search.
          </p>
          <DialogFooter className="-mx-0 -mb-0 flex-row justify-between border-0 bg-transparent p-0">
            <div>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={capture.isPending}
                onClick={() => fileRef.current?.click()}
              >
                Upload file
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!input.trim() || capture.isPending}
              >
                {capture.isPending ? "Parsing…" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
