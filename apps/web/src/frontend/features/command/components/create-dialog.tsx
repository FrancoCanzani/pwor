import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  useEffect,
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
import {
  type CreateDialogLaunch,
  type CreateMode,
} from "@features/command/create-dialog-context";
import { createNote } from "@features/notes/api";
import {
  captureVaultInput,
  createVaultSnippet,
} from "@features/vault/api";
import { ingestFile } from "@features/vault/lib/ingest-file";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";
import { prependFrontmatter } from "@shared/note-frontmatter";

export function CreateDialog({
  open,
  onOpenChange,
  launch = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  launch?: CreateDialogLaunch | null;
}) {
  const [mode, setMode] = useState<CreateMode>("menu");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [snippetTitle, setSnippetTitle] = useState("");
  const [snippetLanguage, setSnippetLanguage] = useState("typescript");
  const [snippetContent, setSnippetContent] = useState("");
  const [captureInput, setCaptureInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: workspaceId } = useCurrentWorkspace();

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setCategoryId(null);
      setSnippetTitle("");
      setSnippetLanguage("typescript");
      setSnippetContent("");
      setCaptureInput("");
      setUploading(false);
      setDragging(false);
      dragDepth.current = 0;
      return;
    }
    setMode(launch?.mode ?? "menu");
    setCategoryId(launch?.categoryId ?? null);
  }, [open, launch]);

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

  const createSnippetMutation = useMutation({
    mutationFn: () =>
      createVaultSnippet(snippetContent, {
        title: snippetTitle.trim() || null,
        language: snippetLanguage.trim() || null,
        workspaceId,
        categoryId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      toast.success("Snippet saved");
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn’t save snippet"),
  });

  const captureMutation = useMutation({
    mutationFn: () =>
      captureVaultInput(captureInput.trim(), workspaceId, categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      toast.success("Added — parsing…");
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn’t add item"),
  });

  const busy =
    createNoteMutation.isPending ||
    createSnippetMutation.isPending ||
    captureMutation.isPending ||
    uploading;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    const list = Array.from(files);
    setUploading(true);
    try {
      let notesChanged = false;
      let vaultChanged = false;
      for (const file of list) {
        const toastId = toast.loading(`Adding ${file.name}…`);
        try {
          const result = await ingestFile(file, { workspaceId, categoryId });
          if (result.kind === "note") {
            notesChanged = true;
            toast.success(`${file.name} added as note`, { id: toastId });
          } else if (result.kind === "snippet") {
            vaultChanged = true;
            toast.success(`${file.name} added as snippet`, { id: toastId });
          } else {
            vaultChanged = true;
            toast.success(`${file.name} added`, { id: toastId });
          }
        } catch {
          toast.error(`Failed to add ${file.name}`, { id: toastId });
        }
      }
      if (notesChanged) {
        await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
      }
      if (vaultChanged) {
        await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
      }
      onOpenChange(false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSnippetSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snippetContent.trim() || busy) return;
    createSnippetMutation.mutate();
  }

  function handleCaptureSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captureInput.trim() || busy) return;
    captureMutation.mutate();
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
              {(
                [
                  {
                    id: "snippet" as const,
                    label: "Snippet",
                    detail: "Code with syntax highlighting",
                  },
                  {
                    id: "capture" as const,
                    label: "Capture",
                    detail: "Paste a URL, text, or drop files",
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted"
                  onClick={() => setMode(item.id)}
                >
                  <span className="text-sm">{item.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.detail}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {mode === "snippet" ? (
          <form onSubmit={handleSnippetSubmit} className="flex flex-col gap-3">
            <DialogHeader>
              <DialogTitle>New snippet</DialogTitle>
            </DialogHeader>
            <Input
              value={snippetTitle}
              onChange={(e) => setSnippetTitle(e.target.value)}
              placeholder="Title"
              disabled={busy}
            />
            <Input
              value={snippetLanguage}
              onChange={(e) => setSnippetLanguage(e.target.value)}
              placeholder="Language (typescript, python…)"
              disabled={busy}
              className="font-mono text-xs"
            />
            <Textarea
              autoFocus
              value={snippetContent}
              onChange={(e) => setSnippetContent(e.target.value)}
              placeholder="Paste code…"
              className="min-h-40 resize-none font-mono text-xs"
              disabled={busy}
            />
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
                disabled={!snippetContent.trim() || busy}
              >
                {createSnippetMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
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
              placeholder="Paste a URL or text…"
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
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                "flex min-h-20 w-full items-center justify-center rounded-md border border-dashed px-4 text-xs transition-colors",
                dragging
                  ? "border-foreground/40 bg-muted/60 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                busy && "pointer-events-none opacity-50",
              )}
            >
              {uploading
                ? "Uploading…"
                : dragging
                  ? "Drop to add"
                  : "Drop files here, or click to choose"}
            </button>
            <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
              {launch?.mode === "capture" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode("menu")}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                disabled={!captureInput.trim() || busy}
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
