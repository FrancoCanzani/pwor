import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent, type SubmitEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createPackTextSource,
  createPackUrlSource,
  packSourcesQueryOptions,
  uploadPackSource,
} from "@features/packs/api";

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
      toast.promise(
        uploadPackSource(packId, file).then(async (source) => {
          await refresh();
          return source;
        }),
        {
          loading: `Uploading ${file.name}…`,
          success: (source) =>
            source.parseStatus === "ready"
              ? `${source.title ?? file.name} ready`
              : `${source.title ?? file.name} uploaded`,
          error: (err) =>
            err instanceof Error ? err.message : `Failed: ${file.name}`,
        },
      );
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
      toast.promise(
        createPackUrlSource(packId, { url: value }).then(async (source) => {
          await refresh();
          setUrl("");
          return source;
        }),
        {
          loading: "Fetching URL…",
          success: (source) =>
            source.parseStatus === "ready"
              ? `${source.title ?? "URL"} ready`
              : `${source.title ?? "URL"} added`,
          error: (err) =>
            err instanceof Error ? err.message : "Could not add URL",
        },
      );
      return;
    }

    toast.promise(
      createPackTextSource(packId, { content: value }).then(async (source) => {
        await refresh();
        setUrl("");
        return source;
      }),
      {
        loading: "Saving text…",
        success: "Text added",
        error: (err) =>
          err instanceof Error ? err.message : "Could not save text",
      },
    );
  }

  return (
    <div className="mb-10 flex flex-col gap-3">
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
          "border border-dashed border-border px-6 py-10 text-center transition-colors",
          dragging && "border-foreground/40 bg-muted/40",
        )}
      >
        <p className="text-sm font-normal">Drop anything</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF · Image · Text · URL
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="font-normal"
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
      </div>

      <form onSubmit={handleUrlOrText} className="flex gap-2">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a URL or text…"
          className="font-normal"
        />
        <Button
          type="submit"
          size="sm"
          className="shrink-0 font-normal"
          disabled={!url.trim()}
        >
          Add
        </Button>
      </form>
    </div>
  );
}
