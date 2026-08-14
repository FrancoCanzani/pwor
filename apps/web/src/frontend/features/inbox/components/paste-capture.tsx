import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { markCaptureHintSeen } from "@features/inbox/lib/capture-hint";
import {
  captureItemInput,
  createItemSnippet,
  uploadItem,
} from "@features/items/api";
import {
  isCodeSnippetFile,
  languageFromFilename,
} from "@features/items/lib/snippet-language";
import { inferLanguageFromContent } from "@shared/infer-language";
import { dedentCode } from "@shared/snippet-format";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-note-editor]")) return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest("[role='textbox']")) return true;
  const tag = target.closest("input, textarea, select");
  return Boolean(tag);
}

export function PasteCapture() {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ strict: false });
  const spaceId = workspaceId ?? null;
  const busyRef = useRef(false);

  useEffect(() => {
    const destination = spaceId ? "space" : "Inbox";

    async function captureText(text: string) {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      const toastId = toast.loading(`Saving to ${destination}…`);
      try {
        await captureItemInput(trimmed, spaceId);
        await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
        markCaptureHintSeen();
        toast.success(`Saved to ${destination}`, { id: toastId });
      } catch {
        toast.error("Couldn’t save paste", { id: toastId });
      } finally {
        busyRef.current = false;
      }
    }

    async function captureFiles(files: File[]) {
      if (files.length === 0 || busyRef.current) return;
      busyRef.current = true;
      try {
        for (const file of files) {
          const toastId = toast.loading(`Adding ${file.name}…`);
          try {
            if (isCodeSnippetFile(file)) {
              const content = dedentCode(await file.text());
              await createItemSnippet(content, {
                title: file.name,
                language:
                  languageFromFilename(file.name) ||
                  inferLanguageFromContent(content),
                workspaceId: spaceId,
              });
            } else {
              await uploadItem(file, spaceId);
            }
            markCaptureHintSeen();
            toast.success(`${file.name} saved to ${destination}`, {
              id: toastId,
            });
          } catch {
            toast.error(`Failed to add ${file.name}`, { id: toastId });
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["item", "items"] });
      } finally {
        busyRef.current = false;
      }
    }

    function onPaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) return;
      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const files = Array.from(clipboard.files ?? []);
      if (files.length > 0) {
        event.preventDefault();
        void captureFiles(files);
        return;
      }

      const text = clipboard.getData("text/plain");
      if (!text.trim()) return;
      event.preventDefault();
      void captureText(text);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [queryClient, spaceId]);

  return null;
}
