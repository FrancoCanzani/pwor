import { UploadIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { packSourcesQueryOptions } from "@features/packs/api";
import {
  ingestFileWithToast,
  ingestTextWithToast,
  ingestUrlWithToast,
} from "@features/packs/lib/ingest-toast";

type Tab = "file" | "url" | "text";

function looksLikeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function PackUploadDialog({
  open,
  onOpenChange,
  packId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packId: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("file");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: packSourcesQueryOptions(packId).queryKey,
    });
  }

  function reset() {
    setTab("file");
    setUrl("");
    setText("");
    setDragging(false);
  }

  function uploadFiles(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    onOpenChange(false);
    for (const file of list) {
      void ingestFileWithToast(packId, file).finally(() => {
        void refresh();
      });
    }
  }

  function handleUrl(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = url.trim();
    if (!value || !looksLikeUrl(value)) return;
    onOpenChange(false);
    void ingestUrlWithToast(packId, value)
      .then(() => setUrl(""))
      .finally(() => {
        void refresh();
      });
  }

  function handleText(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    onOpenChange(false);
    void ingestTextWithToast(packId, value)
      .then(() => setText(""))
      .finally(() => {
        void refresh();
      });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton
        className="gap-3 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Add source</DialogTitle>
          <DialogDescription>
            Drop a file, paste a link, or add text.
          </DialogDescription>
        </DialogHeader>

        <div className="flex rounded-md border border-border p-0.5">
          {(
            [
              { id: "file", label: "File" },
              { id: "url", label: "URL" },
              { id: "text", label: "Text" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex flex-1 items-center justify-center rounded-sm px-2 py-1.5 text-xs font-normal transition-colors",
                tab === item.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "file" ? (
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
              if (event.currentTarget.contains(event.relatedTarget as Node)) {
                return;
              }
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              uploadFiles(event.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border px-4 py-10 transition-colors",
              dragging && "border-foreground/40 bg-muted/40",
            )}
          >
            <UploadIcon className="size-5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-xs font-normal">Drop files here</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                PDF · Image · Spreadsheet · Text
              </p>
            </div>
            <Button
              type="button"
              size="sm"
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
        ) : null}

        {tab === "url" ? (
          <form onSubmit={handleUrl} className="flex flex-col gap-3">
            <Input
              autoFocus
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              className="font-normal"
            />
            <Button
              type="submit"
              className="font-normal"
              disabled={!looksLikeUrl(url.trim())}
            >
              Add URL
            </Button>
          </form>
        ) : null}

        {tab === "text" ? (
          <form onSubmit={handleText} className="flex flex-col gap-3">
            <Textarea
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste or type anything…"
              rows={6}
              className="resize-none font-normal"
            />
            <Button
              type="submit"
              className="font-normal"
              disabled={!text.trim()}
            >
              Add text
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
