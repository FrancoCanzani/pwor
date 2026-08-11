import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SweepEffect } from "@components/sweep-effect";
import { createNote } from "@features/notes/api";
import {
  createVaultSnippet,
  uploadVaultItem,
} from "@features/vault/api";
import {
  isCodeSnippetFile,
  isMarkdownFile,
  languageFromFilename,
} from "@features/vault/lib/snippet-language";
import { inferLanguageFromContent } from "@shared/infer-language";
import {
  inferTitleFromRaw,
  prependFrontmatter,
} from "@shared/note-frontmatter";
import { dedentCode } from "@shared/snippet-format";

const SWEEP_DURATION_MS = 800;

function hasFiles(event: DragEvent): boolean {
  return Boolean(event.dataTransfer?.types.includes("Files"));
}

function isNoteEditorTarget(event: Event): boolean {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest("[data-note-editor]"));
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

      let notesChanged = false;
      let vaultChanged = false;

      await Promise.all(
        list.map(async (file) => {
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
              notesChanged = true;
              toast.success(`${file.name} added as note`, { id: toastId });
              return;
            }

            if (isCodeSnippetFile(file)) {
              const content = dedentCode(await file.text());
              await createVaultSnippet(content, {
                title: file.name,
                language:
                  languageFromFilename(file.name) ||
                  inferLanguageFromContent(content),
                workspaceId,
              });
              vaultChanged = true;
              toast.success(`${file.name} added as snippet`, { id: toastId });
              return;
            }

            await uploadVaultItem(file, workspaceId);
            vaultChanged = true;
            toast.success(`${file.name} added`, { id: toastId });
          } catch {
            toast.error(`Failed to add ${file.name}`, { id: toastId });
          }
        }),
      );

      if (notesChanged) {
        await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
      }
      if (vaultChanged) {
        await queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
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
            Drop to add to this space
          </p>
        </div>
      ) : null}
      {isSweeping ? <SweepEffect /> : null}
    </>
  );
}
