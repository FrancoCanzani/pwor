import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  deletePackSource,
  packSourceQueryOptions,
  packSourcesQueryOptions,
  type PackSource,
  type PackSourceDetail,
  type SourceParseStatus,
} from "@features/packs/api";
import { MarkdownView } from "@features/packs/components/markdown-view";

const STATUS_LABEL: Record<SourceParseStatus, string> = {
  pending: "Parsing",
  ready: "Ready",
  failed: "Failed",
  skipped: "Skipped",
};

function formatBytes(size: number | null) {
  if (size == null || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function typeLabel(item: Pick<PackSource, "type" | "mimeType">) {
  if (item.type === "url") return "url";
  if (item.type === "text") return "text";
  if (item.mimeType?.startsWith("image/")) return "image";
  if (item.mimeType === "application/pdf") return "pdf";
  return item.type;
}

function isImageSource(item: Pick<PackSource, "mimeType">) {
  return Boolean(item.mimeType?.startsWith("image/"));
}

function originalUrl(packId: string, sourceId: string) {
  return `/api/packs/${packId}/sources/${sourceId}/original`;
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all font-normal text-foreground">{value}</dd>
    </div>
  );
}

export function PackSourcesAside({
  packId,
  selectedId,
  onSelect,
}: {
  packId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: items = [] } = useQuery({
    ...packSourcesQueryOptions(packId),
    refetchInterval: (query) => {
      const sources = query.state.data ?? [];
      return sources.some((item) => item.parseStatus === "pending")
        ? 1500
        : false;
    },
  });

  if (items.length === 0) {
    return (
      <div className="px-3 py-6 text-xs text-muted-foreground">
        No sources yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const active = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0",
              active ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="truncate text-xs font-normal text-foreground">
              {item.title || item.filename || "Untitled"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{typeLabel(item)}</span>
              <span>·</span>
              <span>{STATUS_LABEL[item.parseStatus]}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function PackSourcePane({
  packId,
  sourceId,
  onRemoved,
}: {
  packId: string;
  sourceId: string;
  onRemoved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const { data } = useQuery({
    ...packSourceQueryOptions(packId, sourceId),
    refetchInterval: (query) =>
      query.state.data?.parseStatus === "pending" ? 1500 : false,
  });

  const remove = useMutation({
    mutationFn: () => deletePackSource(packId, sourceId),
    onSuccess: async () => {
      toast.success(`Removed ${data?.title ?? "source"}`);
      await queryClient.invalidateQueries({
        queryKey: packSourcesQueryOptions(packId).queryKey,
      });
      onRemoved?.();
    },
  });

  if (!data) return null;

  const hasMarkdown = Boolean(data.extractedMarkdown?.trim());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-normal tracking-tight">
            {data.title || data.filename || "Untitled"}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {typeLabel(data)} · {STATUS_LABEL[data.parseStatus]}
            {formatBytes(data.size) ? (
              <span className="font-nums"> · {formatBytes(data.size)}</span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasMarkdown ? (
            <div className="mr-1 flex rounded-md border border-border p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[11px]",
                  mode === "preview" ? "bg-muted" : "text-muted-foreground",
                )}
                onClick={() => setMode("preview")}
              >
                Preview
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[11px]",
                  mode === "source" ? "bg-muted" : "text-muted-foreground",
                )}
                onClick={() => setMode("source")}
              >
                Source
              </button>
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Source actions"
                />
              }
            >
              <DotsHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <DropdownMenuItem
                      className="font-normal text-xs text-destructive"
                      onSelect={(event) => event.preventDefault()}
                    />
                  }
                >
                  Remove
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove source?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removes it from this pack. The original stays if other
                      packs still reference it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => remove.mutate()}
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SourceBody packId={packId} data={data} mode={mode} />
      </div>
    </div>
  );
}

function SourceBody({
  packId,
  data,
  mode,
}: {
  packId: string;
  data: PackSourceDetail;
  mode: "preview" | "source";
}) {
  const markdown = data.extractedMarkdown?.trim() ?? "";
  const imageSrc = isImageSource(data)
    ? originalUrl(packId, data.id)
    : null;

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <dl className="flex flex-col gap-1.5 border-b border-border pb-5">
        <MetaRow label="Title" value={data.title} />
        <MetaRow label="Type" value={data.type} />
        <MetaRow label="Filename" value={data.filename} />
        <MetaRow label="MIME" value={data.mimeType} />
        <MetaRow label="Size" value={formatBytes(data.size)} />
        <MetaRow label="URL" value={data.sourceUrl} />
        <MetaRow label="Status" value={STATUS_LABEL[data.parseStatus]} />
        <MetaRow label="Parse error" value={data.parseError} />
        <MetaRow label="Parsed" value={formatWhen(data.parsedAt)} />
        <MetaRow label="Added" value={formatWhen(data.addedAt)} />
        <MetaRow label="Created" value={formatWhen(data.createdAt)} />
        <MetaRow label="Updated" value={formatWhen(data.updatedAt)} />
      </dl>

      {data.parseStatus === "pending" ? (
        <p className="text-sm text-muted-foreground">Parsing…</p>
      ) : null}

      {data.parseStatus === "failed" ? (
        <p className="text-sm text-destructive">
          {data.parseError || "Parse failed"}
        </p>
      ) : null}

      {imageSrc ? (
        <div className="overflow-hidden rounded-md border border-border">
          <img
            src={imageSrc}
            alt={data.title || data.filename || "Source image"}
            className="max-h-[28rem] w-full bg-muted/30 object-contain"
          />
        </div>
      ) : null}

      {markdown ? (
        mode === "preview" ? (
          <MarkdownView markdown={markdown} />
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
            {markdown}
          </pre>
        )
      ) : data.parseStatus === "ready" || data.parseStatus === "skipped" ? (
        <p className="text-sm text-muted-foreground">No markdown yet.</p>
      ) : null}
    </div>
  );
}
