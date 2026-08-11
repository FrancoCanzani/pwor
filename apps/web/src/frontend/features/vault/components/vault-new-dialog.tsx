import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  useRef,
  useState,
  type DragEvent,
  type SubmitEvent,
} from "react";
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
import { cn } from "@/lib/utils";
import {
  captureVaultInput,
  uploadVaultItem,
} from "@features/vault/api";

export function VaultNewButton({
  categoryId,
  className,
}: {
  categoryId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="new"
        className={cn(
          "h-auto px-1.5 py-1 text-xs leading-none font-normal",
          className,
        )}
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
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
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

  const busy = capture.isPending || uploading;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    const list = Array.from(files);
    setUploading(true);
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
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || busy) return;
    capture.mutate();
  }

  function onDragEnter(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function onDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setInput("");
          setDragging(false);
          dragDepth.current = 0;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste anything — link, tweet, text…"
            className="min-h-36 resize-none text-sm"
            disabled={busy}
          />

          <input
            ref={fileRef}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "flex min-h-24 w-full flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors",
              dragging
                ? "border-foreground/40 bg-muted/60 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              busy && "pointer-events-none opacity-50",
            )}
          >
            <span className="text-xs">
              {uploading
                ? "Uploading…"
                : dragging
                  ? "Drop to add"
                  : "Drop files here, or click to choose"}
            </span>
          </button>

          <DialogFooter className="-mx-0 -mb-0 flex-row justify-end border-0 bg-transparent p-0">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!input.trim() || busy}>
                {capture.isPending ? "Parsing…" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
