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
import { PageEmpty } from "@components/page-empty";
import {
  deletePackSource,
  packSourceQueryOptions,
  packSourcesQueryOptions,
  type PackSource,
  type SourceParseStatus,
} from "@features/packs/api";

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

function typeLabel(item: PackSource) {
  if (item.type === "url") return "url";
  if (item.type === "text") return "text";
  if (item.mimeType?.startsWith("image/")) return "image";
  if (item.mimeType === "application/pdf") return "pdf";
  return "file";
}

function SourceMarkdown({
  packId,
  sourceId,
}: {
  packId: string;
  sourceId: string;
}) {
  const { data } = useQuery(packSourceQueryOptions(packId, sourceId));
  if (!data) return null;

  if (data.parseStatus === "failed") {
    return (
      <p className="border-t border-border px-3 py-3 text-xs text-destructive">
        {data.parseError || "Parse failed"}
      </p>
    );
  }

  if (data.parseStatus === "pending") {
    return (
      <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
        Parsing…
      </p>
    );
  }

  const markdown = data.extractedMarkdown?.trim();
  if (!markdown) {
    return (
      <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
        No markdown yet.
      </p>
    );
  }

  return (
    <pre className="max-h-80 overflow-auto border-t border-border px-3 py-3 text-xs whitespace-pre-wrap text-muted-foreground">
      {markdown}
    </pre>
  );
}

function SourceRow({ packId, item }: { packId: string; item: PackSource }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const size = formatBytes(item.size);

  const remove = useMutation({
    mutationFn: () => deletePackSource(packId, item.id),
    onSuccess: async () => {
      toast.success(`Removed ${item.title ?? "source"}`);
      await queryClient.invalidateQueries({
        queryKey: packSourcesQueryOptions(packId).queryKey,
      });
    },
  });

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((value) => !value)}
        >
          <div className="truncate text-sm font-normal">
            {item.title || item.filename || "Untitled"}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{typeLabel(item)}</span>
            <span>{STATUS_LABEL[item.parseStatus]}</span>
            {size ? <span className="font-nums">{size}</span> : null}
            {item.sourceUrl ? (
              <span className="truncate">{item.sourceUrl}</span>
            ) : null}
          </div>
        </button>

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
            <DropdownMenuItem
              className="font-normal text-xs"
              onClick={() => setOpen(true)}
            >
              View
            </DropdownMenuItem>
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
                    Removes it from this pack. The original stays if other packs
                    still reference it.
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
      {open ? <SourceMarkdown packId={packId} sourceId={item.id} /> : null}
    </div>
  );
}

export function PackSourcesList({ packId }: { packId: string }) {
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
      <PageEmpty
        title="No sources yet"
        description="Drop a file, paste a URL, or add text to start."
      />
    );
  }

  return (
    <div className="border-t border-border">
      {items.map((item) => (
        <SourceRow key={item.id} packId={packId} item={item} />
      ))}
    </div>
  );
}
