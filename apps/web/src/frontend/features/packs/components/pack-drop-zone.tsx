import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { packSourcesQueryOptions } from "@features/packs/api";
import {
  ingestFileWithToast,
  ingestTextWithToast,
  ingestUrlWithToast,
} from "@features/packs/lib/ingest-toast";

function looksLikeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function PackDropZone({ packId }: { packId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: packSourcesQueryOptions(packId).queryKey,
    });
  }

  function uploadFiles(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;

    for (const file of list) {
      void ingestFileWithToast(packId, file).finally(() => {
        void refresh();
      });
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(event.dataTransfer.files);
  }

  function handleUrlOrText(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = url.trim();
    if (!value) return;

    if (looksLikeUrl(value)) {
      void ingestUrlWithToast(packId, value)
        .then(() => setUrl(""))
        .finally(() => {
          void refresh();
        });
      return;
    }

    void ingestTextWithToast(packId, value)
      .then(() => setUrl(""))
      .finally(() => {
        void refresh();
      });
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2.5 transition-colors",
          dragging && "border-foreground/40 bg-muted/40",
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-normal">Drop anything</p>
          <p className="text-[11px] text-muted-foreground">
            PDF · Image · Text · URL
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 font-normal"
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <form onSubmit={handleUrlOrText} className="flex gap-2">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a URL or text…"
          className="h-8 font-normal"
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 shrink-0 font-normal"
          disabled={!url.trim()}
        >
          Add
        </Button>
      </form>
    </div>
  );
}
