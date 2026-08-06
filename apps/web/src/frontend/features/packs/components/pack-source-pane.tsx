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
  type SourceParseStatus,
} from "@features/packs/api";
import { MarkdownView } from "@features/packs/components/markdown-view";
import { SourceOriginalView } from "@features/packs/components/source-original-view";
import {
  formatBytes,
  sourceKindLabel,
} from "@features/packs/lib/source-kind";

const STATUS_LABEL: Record<SourceParseStatus, string> = {
  pending: "Parsing",
  ready: "Ready",
  failed: "Failed",
  skipped: "Skipped",
};

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
              <span>{sourceKindLabel(item)}</span>
              {item.parseStatus !== "ready" ? (
                <>
                  <span>·</span>
                  <span>{STATUS_LABEL[item.parseStatus]}</span>
                </>
              ) : null}
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
  const [mode, setMode] = useState<"original" | "markdown">("original");
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
  const size = formatBytes(data.size);
  const kind = sourceKindLabel(data);
  const showStatus = data.parseStatus !== "ready";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-normal tracking-tight">
            {data.title || data.filename || "Untitled"}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span>{kind}</span>
            {size ? (
              <span className="font-nums"> · {size}</span>
            ) : null}
            {showStatus ? (
              <span> · {STATUS_LABEL[data.parseStatus]}</span>
            ) : null}
            {data.sourceUrl ? (
              <>
                {" · "}
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-muted-foreground underline-offset-2 hover:underline"
                >
                  Link
                </a>
              </>
            ) : null}
          </p>
          {data.parseStatus === "failed" && data.parseError ? (
            <p className="mt-1 text-[11px] text-destructive">
              {data.parseError}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="mr-1 flex rounded-md border border-border p-0.5">
            <button
              type="button"
              className={cn(
                "rounded-sm px-2 py-0.5 text-[11px]",
                mode === "original" ? "bg-muted" : "text-muted-foreground",
              )}
              onClick={() => setMode("original")}
            >
              Original
            </button>
            <button
              type="button"
              className={cn(
                "rounded-sm px-2 py-0.5 text-[11px]",
                mode === "markdown" ? "bg-muted" : "text-muted-foreground",
              )}
              onClick={() => setMode("markdown")}
            >
              Markdown
            </button>
          </div>
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

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "original" ? (
          <div className="h-full min-h-0 p-4">
            <SourceOriginalView packId={packId} source={data} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-5 py-5">
            {data.parseStatus === "pending" ? (
              <p className="text-sm text-muted-foreground">Parsing…</p>
            ) : hasMarkdown ? (
              <MarkdownView markdown={data.extractedMarkdown!} />
            ) : (
              <p className="text-sm text-muted-foreground">No markdown yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
