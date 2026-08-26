import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SweepEffect } from "@components/sweep-effect";
import { useCaptureComposer } from "@features/command/capture-composer-context";
import { useCaptureFeedback } from "@features/command/lib/use-capture-feedback";
import { markCaptureHintSeen } from "@features/inbox/lib/capture-hint";
import { createNote } from "@features/notes/api";
import { bodyToDocument } from "@features/notes/lib/legacy-document";
import { uploadItem, type Item } from "@features/items/api";
import { workspacesQueryOptions } from "@features/workspaces/api";
import { inferTitleFromRaw, serializeTiptapBody } from "@shared/note-frontmatter";

const SWEEP_DURATION_MS = 800;

function hasFiles(event: DragEvent): boolean {
  return Boolean(event.dataTransfer?.types.includes("Files"));
}

function isNoteEditorTarget(event: Event): boolean {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest("[data-note-editor]"));
}

function isMarkdownFile(file: File) {
  return file.name.toLowerCase().endsWith(".md") || file.type === "text/markdown";
}

export function ItemDropZone() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const dragDepth = useRef(0);
  const queryClient = useQueryClient();
  const { spaceId } = useParams({ strict: false });
  const { open, isOpen } = useCaptureComposer();
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);
  const { notifySaved, invalidateItems } = useCaptureFeedback();
  const label = spaceId
    ? spaces.find((space) => space.id === spaceId)?.name.trim() || "Untitled"
    : "Inbox";

  const handleFiles = useCallback(
    async (files: FileList) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setIsSweeping(true);
      window.setTimeout(() => setIsSweeping(false), SWEEP_DURATION_MS);

      let notesChanged = false;
      const captured: Item[] = [];
      const destSpaceId = spaceId ?? null;

      for (const file of list) {
        try {
          if (isMarkdownFile(file) && destSpaceId) {
            const raw = await file.text();
            const inferred = inferTitleFromRaw(raw).title;
            const fallbackTitle = file.name.replace(/\.md$/i, "");
            const title = inferred || fallbackTitle;
            await createNote({
              body: serializeTiptapBody(bodyToDocument(raw)),
              title,
              workspaceId: destSpaceId,
            });
            notesChanged = true;
            toast.success(`${file.name} added as note`);
            continue;
          }

          captured.push(await uploadItem(file, destSpaceId));
        } catch {
          toast.error(`Failed to add ${file.name}`);
        }
      }

      if (notesChanged) {
        await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
        markCaptureHintSeen();
      }
      if (captured.length > 0) {
        await invalidateItems();
        notifySaved(label, captured);
      }
    },
    [invalidateItems, label, notifySaved, queryClient, spaceId],
  );

  useEffect(() => {
    function onDragEnter(event: DragEvent) {
      if (!hasFiles(event) || isNoteEditorTarget(event) || isOpen) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDraggingOver(true);
    }

    function onDragOver(event: DragEvent) {
      if (!hasFiles(event) || isNoteEditorTarget(event)) return;
      event.preventDefault();
    }

    function onDragLeave(event: DragEvent) {
      if (!hasFiles(event) || isNoteEditorTarget(event) || isOpen) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDraggingOver(false);
    }

    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      if (isNoteEditorTarget(event)) {
        dragDepth.current = 0;
        setIsDraggingOver(false);
        return;
      }
      event.preventDefault();
      dragDepth.current = 0;
      setIsDraggingOver(false);

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      if (isOpen) {
        open({ files: Array.from(files) });
        return;
      }
      void handleFiles(files);
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles, isOpen, open]);

  return (
    <>
      {isDraggingOver ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center border border-dashed border-foreground/20 bg-background/80">
          <p className="text-sm text-muted-foreground">
            {spaceId ? "Drop to add to this space" : "Drop to save to Inbox"}
          </p>
        </div>
      ) : null}
      {isSweeping ? <SweepEffect /> : null}
    </>
  );
}
