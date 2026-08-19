import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useCaptureComposer } from "@features/command/capture-composer-context";
import { isCaptureUrl } from "@features/command/lib/capture";
import { useCaptureFeedback } from "@features/command/lib/use-capture-feedback";
import { captureItemInput, uploadItem, type Item } from "@features/items/api";
import { workspacesQueryOptions } from "@features/workspaces/api";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-note-editor]")) return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest("[role='textbox']")) return true;
  const tag = target.closest("input, textarea, select");
  return Boolean(tag);
}

export function PasteCapture() {
  const { workspaceId } = useParams({ strict: false });
  const spaceId = workspaceId ?? null;
  const busyRef = useRef(false);
  const { open, isOpen } = useCaptureComposer();
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);
  const { notifySaved, invalidateItems, savedLabel } = useCaptureFeedback();
  const label = spaceId
    ? spaces.find((space) => space.id === spaceId)?.name.trim() || "Untitled"
    : "Inbox";

  useEffect(() => {
    async function captureText(text: string) {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      try {
        const item = await captureItemInput(trimmed, spaceId);
        await invalidateItems();
        notifySaved(savedLabel([item], label, spaces), [item]);
      } catch {
        toast.error("Couldn’t save paste");
      } finally {
        busyRef.current = false;
      }
    }

    async function captureFiles(files: File[]) {
      if (files.length === 0 || busyRef.current) return;
      busyRef.current = true;
      try {
        const created: Item[] = [];
        for (const file of files) {
          created.push(await uploadItem(file, spaceId));
        }
        await invalidateItems();
        notifySaved(label, created);
      } catch {
        toast.error("Couldn’t save paste");
      } finally {
        busyRef.current = false;
      }
    }

    function onPaste(event: ClipboardEvent) {
      if (isOpen) return;
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
      if (isCaptureUrl(text)) {
        void captureText(text);
        return;
      }
      open({ input: text });
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [
    invalidateItems,
    isOpen,
    label,
    notifySaved,
    open,
    savedLabel,
    spaceId,
    spaces,
  ]);

  return null;
}
