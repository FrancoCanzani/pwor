import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { markCaptureHintSeen } from "@features/inbox/lib/capture-hint";
import { captureItemInput, uploadItem } from "@features/items/api";
import { createNote } from "@features/notes/api";
import { inferTitleFromRaw } from "@shared/note-frontmatter";

function isMarkdownFile(file: File) {
  return file.name.toLowerCase().endsWith(".md") || file.type === "text/markdown";
}

export function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { workspaceId: routeWorkspaceId } = useParams({ strict: false });
  const spaceId = routeWorkspaceId ?? null;

  useEffect(() => {
    if (!open) {
      setTitle("");
      setInput("");
      setUploading(false);
    }
  }, [open]);

  const captureMutation = useMutation({
    mutationFn: () =>
      captureItemInput(input.trim(), spaceId, {
        title: title.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      markCaptureHintSeen();
      toast.success(`Saved to ${spaceId ? "space" : "Inbox"}`);
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn’t add item"),
  });

  const busy = captureMutation.isPending || uploading;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    const list = Array.from(files);
    setUploading(true);
    try {
      for (const file of list) {
        const toastId = toast.loading(`Adding ${file.name}…`);
        try {
          if (isMarkdownFile(file) && spaceId) {
            const raw = await file.text();
            const inferred = inferTitleFromRaw(raw).title;
            const fallbackTitle = file.name.replace(/\.md$/i, "");
            const noteTitle = inferred || fallbackTitle;
            await createNote({
              body: raw,
              title: noteTitle,
              workspaceId: spaceId,
            });
            toast.success(`${file.name} added as note`, { id: toastId });
          } else {
            await uploadItem(file, spaceId);
            toast.success(
              `${file.name} saved to ${spaceId ? "space" : "Inbox"}`,
              { id: toastId },
            );
          }
          markCaptureHintSeen();
        } catch {
          toast.error(`Failed to add ${file.name}`, { id: toastId });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      onOpenChange(false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || busy) return;
    captureMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Capture</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="h-8 text-xs placeholder:text-[11px]"
            disabled={busy}
          />
          <Textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a URL or text…"
            className="min-h-28 resize-none font-mono text-xs placeholder:font-sans"
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
            className={cn(
              "flex min-h-20 w-full items-center justify-center rounded-md border border-dashed border-border px-4 text-xs text-muted-foreground select-none hover:border-foreground/30 hover:text-foreground active:border-foreground/30 active:text-foreground",
              busy && "pointer-events-none opacity-50",
            )}
          >
            {uploading ? "Uploading…" : "Drop files here, or click to choose"}
          </button>
          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!input.trim() || busy}>
              {captureMutation.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
