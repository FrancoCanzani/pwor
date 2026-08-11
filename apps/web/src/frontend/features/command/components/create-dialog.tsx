import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createNote } from "@features/notes/api";
import {
  captureVaultInput,
  createVaultSnippet,
  uploadVaultItem,
} from "@features/vault/api";
import {
  isCodeSnippetFile,
  isMarkdownFile,
  languageFromFilename,
} from "@features/vault/lib/snippet-language";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";
import { inferLanguageFromContent } from "@shared/infer-language";
import {
  inferTitleFromRaw,
  prependFrontmatter,
} from "@shared/note-frontmatter";

type CreateMode = "menu" | "capture";

export function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<CreateMode>("menu");
  const [captureInput, setCaptureInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: workspaceId } = useCurrentWorkspace();

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setCaptureInput("");
      setUploading(false);
    }
  }, [open]);

  const createNoteMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) throw new Error("No space selected");
      const title = "Untitled";
      const body = prependFrontmatter("", { title, tags: [] });
      return createNote(body, title, workspaceId);
    },
    onSuccess: async (note) => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
      onOpenChange(false);
      await navigate({
        to: "/$workspaceId/notes/$noteId",
        params: { workspaceId, noteId: note.id },
      });
    },
    onError: () => toast.error("Couldn’t create note"),
  });

  const captureMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) throw new Error("No space selected");
      return captureVaultInput(captureInput.trim(), workspaceId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      toast.success("Added");
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn’t add item"),
  });

  const busy =
    createNoteMutation.isPending || captureMutation.isPending || uploading;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    if (!workspaceId) {
      toast.error("Open a space first");
      return;
    }
    const list = Array.from(files);
    setUploading(true);
    try {
      for (const file of list) {
        const toastId = toast.loading(`Adding ${file.name}…`);
        try {
          if (isMarkdownFile(file)) {
            const raw = await file.text();
            const inferred = inferTitleFromRaw(raw).title;
            const fallbackTitle = file.name.replace(/\.md$/i, "");
            const title = inferred || fallbackTitle;
            const body = inferred
              ? raw
              : prependFrontmatter(raw, { title: fallbackTitle, tags: [] });
            await createNote(body, title, workspaceId);
            toast.success(`${file.name} added as note`, { id: toastId });
          } else if (isCodeSnippetFile(file)) {
            const content = await file.text();
            await createVaultSnippet(content, {
              title: file.name,
              language:
                languageFromFilename(file.name) ||
                inferLanguageFromContent(content),
              workspaceId,
            });
            toast.success(`${file.name} added as snippet`, { id: toastId });
          } else {
            await uploadVaultItem(file, workspaceId);
            toast.success(`${file.name} added`, { id: toastId });
          }
        } catch {
          toast.error(`Failed to add ${file.name}`, { id: toastId });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      onOpenChange(false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleCaptureSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captureInput.trim() || busy) return;
    captureMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        {mode === "menu" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create new</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="flex flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                disabled={busy || !workspaceId}
                onClick={() => createNoteMutation.mutate()}
              >
                <span className="text-sm">
                  {createNoteMutation.isPending ? "Creating…" : "Note"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Markdown notebook
                </span>
              </button>
              <button
                type="button"
                className="flex flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                disabled={!workspaceId}
                onClick={() => setMode("capture")}
              >
                <span className="text-sm">Capture</span>
                <span className="text-[11px] text-muted-foreground">
                  Paste a URL, text, or code
                </span>
              </button>
            </div>
          </>
        ) : null}

        {mode === "capture" ? (
          <form onSubmit={handleCaptureSubmit} className="flex flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Capture</DialogTitle>
            </DialogHeader>
            <Textarea
              autoFocus
              value={captureInput}
              onChange={(e) => setCaptureInput(e.target.value)}
              placeholder="Paste a URL, text, or code…"
              className="min-h-28 resize-none text-xs"
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
              disabled={busy || !workspaceId}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex min-h-20 w-full items-center justify-center rounded-md border border-dashed border-border px-4 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                busy && "pointer-events-none opacity-50",
              )}
            >
              {uploading ? "Uploading…" : "Drop files here, or click to choose"}
            </button>
            <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode("menu")}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={!captureInput.trim() || busy || !workspaceId}
              >
                {captureMutation.isPending ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
