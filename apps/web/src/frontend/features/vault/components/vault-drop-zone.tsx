import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SweepEffect } from "@components/sweep-effect";
import { createNote } from "@features/notes/api";
import { uploadVaultItem } from "@features/vault/api";

const SWEEP_DURATION_MS = 800;

function hasFiles(event: DragEvent): boolean {
  return Boolean(event.dataTransfer?.types.includes("Files"));
}

function isNoteEditorTarget(event: Event): boolean {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest("[data-note-editor]"));
}

function isMarkdownFile(file: File): boolean {
  return (
    file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")
  );
}

export function VaultDropZone() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const dragDepth = useRef(0);
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ strict: false });

  const handleFiles = useCallback(
    async (files: FileList) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setIsSweeping(true);
      window.setTimeout(() => setIsSweeping(false), SWEEP_DURATION_MS);

      const markdownFiles = list.filter(isMarkdownFile);
      const otherFiles = list.filter((file) => !isMarkdownFile(file));

      await Promise.all([
        ...markdownFiles.map(async (file) => {
          const toastId = toast.loading(`Adding ${file.name} to Notes…`);
          try {
            const body = await file.text();
            const title = file.name.replace(/\.md$/i, "");
            await createNote(body, title, workspaceId);
            toast.success(`${file.name} added to Notes`, { id: toastId });
          } catch {
            toast.error(`Failed to add ${file.name} to Notes`, {
              id: toastId,
            });
          }
        }),
        ...otherFiles.map(async (file) => {
          const toastId = toast.loading(`Uploading ${file.name}…`);
          try {
            await uploadVaultItem(file, workspaceId);
            toast.success(`${file.name} added to Vault`, { id: toastId });
          } catch {
            toast.error(`Failed to upload ${file.name}`, { id: toastId });
          }
        }),
      ]);

      if (markdownFiles.length > 0) {
        await queryClient.invalidateQueries({
          queryKey: ["notes", "list"],
        });
      }
      if (otherFiles.length > 0) {
        await queryClient.invalidateQueries({
          queryKey: ["vault", "items"],
        });
      }
    },
    [queryClient, workspaceId],
  );

  useEffect(() => {
    function onDragEnter(event: DragEvent) {
      if (!hasFiles(event) || isNoteEditorTarget(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDraggingOver(true);
    }

    function onDragOver(event: DragEvent) {
      if (!hasFiles(event) || isNoteEditorTarget(event)) return;
      event.preventDefault();
    }

    function onDragLeave(event: DragEvent) {
      if (!hasFiles(event) || isNoteEditorTarget(event)) return;
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
      if (files && files.length > 0) void handleFiles(files);
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
  }, [handleFiles]);

  return (
    <>
      {isDraggingOver ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center border border-dashed border-foreground/20 bg-background/80">
          <p className="text-sm text-muted-foreground">
            Drop to add to Vault
          </p>
        </div>
      ) : null}
      {isSweeping ? <SweepEffect /> : null}
    </>
  );
}
