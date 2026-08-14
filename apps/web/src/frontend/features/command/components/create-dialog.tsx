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
import { createNote } from "@features/notes/api";
import {
  captureItemInput,
  createItemSnippet,
  uploadItem,
} from "@features/items/api";
import {
  isCodeSnippetFile,
  isMarkdownFile,
  languageFromFilename,
} from "@features/items/lib/snippet-language";
import { inferLanguageFromContent, looksLikeCode } from "@shared/infer-language";
import {
  inferTitleFromRaw,
  prependFrontmatter,
} from "@shared/note-frontmatter";
import {
  dedentCode,
  titleFromSnippet,
} from "@shared/snippet-format";

export function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureInput, setCaptureInput] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { workspaceId: routeWorkspaceId } = useParams({ strict: false });
  const spaceId = routeWorkspaceId ?? null;

  const codeMode = looksLikeCode(captureInput);
  const inferredLanguage = codeMode
    ? inferLanguageFromContent(dedentCode(captureInput))
    : null;

  useEffect(() => {
    if (!open) {
      setCaptureTitle("");
      setCaptureInput("");
      setTitle("");
      setTitleTouched(false);
      setUploading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!codeMode) {
      if (!titleTouched) setTitle("");
      return;
    }
    if (titleTouched) return;
    setTitle(titleFromSnippet(dedentCode(captureInput), inferredLanguage));
  }, [open, codeMode, captureInput, inferredLanguage, titleTouched]);

  const captureMutation = useMutation({
    mutationFn: async () => {
      const trimmed = captureInput.trim();
      if (looksLikeCode(trimmed)) {
        const content = dedentCode(trimmed);
        const language = inferLanguageFromContent(content);
        return createItemSnippet(content, {
          title: title.trim() || titleFromSnippet(content, language),
          language,
          workspaceId: spaceId,
        });
      }
      return captureItemInput(trimmed, spaceId, {
        title: captureTitle.trim() || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      markCaptureHintSeen();
      toast.success(
        codeMode ? "Snippet added" : `Saved to ${spaceId ? "space" : "Inbox"}`,
      );
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
          if (isMarkdownFile(file)) {
            const raw = await file.text();
            if (spaceId) {
              const inferred = inferTitleFromRaw(raw).title;
              const fallbackTitle = file.name.replace(/\.md$/i, "");
              const noteTitle = inferred || fallbackTitle;
              const body = inferred
                ? raw
                : prependFrontmatter(raw, { title: fallbackTitle, tags: [] });
              await createNote(body, noteTitle, spaceId);
              markCaptureHintSeen();
              toast.success(`${file.name} added as note`, { id: toastId });
            } else {
              await captureItemInput(raw, null, {
                title: file.name.replace(/\.md$/i, "") || null,
              });
              markCaptureHintSeen();
              toast.success(`${file.name} saved to Inbox`, { id: toastId });
            }
          } else if (isCodeSnippetFile(file)) {
            const content = dedentCode(await file.text());
            await createItemSnippet(content, {
              title: file.name,
              language:
                languageFromFilename(file.name) ||
                inferLanguageFromContent(content),
              workspaceId: spaceId,
            });
            markCaptureHintSeen();
            toast.success(`${file.name} added as snippet`, { id: toastId });
          } else {
            await uploadItem(file, spaceId);
            markCaptureHintSeen();
            toast.success(
              `${file.name} saved to ${spaceId ? "space" : "Inbox"}`,
              { id: toastId },
            );
          }
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

  function handleCaptureSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captureInput.trim() || busy) return;
    captureMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <form onSubmit={handleCaptureSubmit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Capture</DialogTitle>
          </DialogHeader>
          {codeMode ? (
            <Input
              value={title}
              onChange={(e) => {
                setTitleTouched(true);
                setTitle(e.target.value);
              }}
              placeholder="Snippet title"
              className="text-xs"
              disabled={busy}
              aria-label="Snippet title"
            />
          ) : (
            <Input
              value={captureTitle}
              onChange={(e) => setCaptureTitle(e.target.value)}
              placeholder="Title (optional)"
              className="h-8 text-xs placeholder:text-[11px]"
              disabled={busy}
            />
          )}
          <Textarea
            autoFocus
            value={captureInput}
            onChange={(e) => setCaptureInput(e.target.value)}
            placeholder="Paste a URL, text, or code…"
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
            <Button
              type="submit"
              disabled={!captureInput.trim() || busy}
            >
              {captureMutation.isPending
                ? codeMode
                  ? "Saving…"
                  : "Adding…"
                : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
