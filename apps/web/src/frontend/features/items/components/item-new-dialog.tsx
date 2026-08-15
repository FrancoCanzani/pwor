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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { markCaptureHintSeen } from "@features/inbox/lib/capture-hint";
import { captureItemInput, uploadItem } from "@features/items/api";
import { createNote } from "@features/notes/api";
import {
  inferTitleFromRaw,
  prependFrontmatter,
} from "@shared/note-frontmatter";

function isMarkdownFile(file: File) {
  return file.name.toLowerCase().endsWith(".md") || file.type === "text/markdown";
}

export function ItemNewButton({ className }: { className?: string }) {
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
      <ItemNewDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ItemNewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  const capture = useMutation({
    mutationFn: () =>
      captureItemInput(input.trim(), workspaceId, {
        title: title.trim() || null,
      }),
    onSuccess: () => {
      markCaptureHintSeen();
      toast.success("Added");
      setInput("");
      setTitle("");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["item", "items"] });
    },
    onError: () => toast.error("Couldn’t add to Item"),
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
            if (isMarkdownFile(file)) {
              const raw = await file.text();
              const inferred = inferTitleFromRaw(raw).title;
              const fallbackTitle = file.name.replace(/\.md$/i, "");
              const body = inferred
                ? raw
                : prependFrontmatter(raw, { title: fallbackTitle, tags: [] });
              await createNote({
                body,
                title: inferred || fallbackTitle,
                workspaceId,
              });
              toast.success(`${file.name} added as note`, { id: toastId });
            } else {
              await uploadItem(file, workspaceId, {
                title: list.length === 1 ? title.trim() || null : null,
              });
              toast.success(`${file.name} added`, { id: toastId });
            }
            markCaptureHintSeen();
          } catch {
            toast.error(`Failed to upload ${file.name}`, { id: toastId });
          }
        }),
      );
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
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
          setTitle("");
          setInput("");
          setDragging(false);
          dragDepth.current = 0;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            placeholder="Paste anything"
            className="min-h-28 resize-none font-mono text-xs placeholder:font-sans placeholder:text-[11px]"
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
              "flex min-h-28 w-full flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors select-none",
              dragging
                ? "border-foreground/40 bg-muted/60 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground active:border-foreground/30 active:text-foreground",
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
                {capture.isPending ? "Adding…" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
