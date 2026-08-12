import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  captureVaultInput,
  createVaultSnippet,
  uploadVaultItem,
} from "@features/vault/api";
import {
  isCodeSnippetFile,
  languageFromFilename,
} from "@features/vault/lib/snippet-language";
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

/**
 * When focus is not in an editable field, paste captures into Inbox
 * (Shiori-style: paste a URL/text anywhere in the app).
 */
export function PasteCapture() {
  const queryClient = useQueryClient();
  const busyRef = useRef(false);

  useEffect(() => {
    async function captureText(text: string) {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      const toastId = toast.loading("Saving to Inbox…");
      try {
        await captureVaultInput(trimmed, null);
        await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
        toast.success("Saved to Inbox", { id: toastId });
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
              await createVaultSnippet(content, {
                title: file.name,
                language:
                  languageFromFilename(file.name) ||
                  inferLanguageFromContent(content),
                workspaceId: null,
              });
            } else {
              await uploadVaultItem(file, null);
            }
            toast.success(`${file.name} saved to Inbox`, { id: toastId });
          } catch {
            toast.error(`Failed to add ${file.name}`, { id: toastId });
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
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
  }, [queryClient]);

  return null;
}
