import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  vaultFileTextQueryOptions,
  vaultItemQueryOptions,
  vaultSheetQueryOptions,
  type VaultItem,
} from "@features/vault/api";
import { PdfViewer } from "@features/vault/components/pdf-viewer";
import { SheetViewer } from "@features/vault/components/sheet-viewer";
import { isTextPreviewable } from "@features/vault/lib/preview";
import { isSheetPreviewable } from "@features/vault/lib/sheet";

function TextPreview({
  content,
  downloadUrl,
}: {
  content: string | null;
  downloadUrl?: string;
}) {
  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <div className="flex shrink-0 justify-end gap-2">
        {downloadUrl ? (
          <Button variant="outline" render={<a href={downloadUrl} download />}>
            Download
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={!content}
          onClick={() => {
            if (!content) return;
            void navigator.clipboard.writeText(content);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {content !== null ? (
          <pre className="whitespace-pre-wrap text-sm text-foreground">
            {content}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export function VaultViewer({
  item,
  open,
  onOpenChange,
}: {
  item: VaultItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isTextItem = item.kind === "text";
  const fileUrl = `/api/vault/${item.id}/file`;
  const isImage = item.mimeType?.startsWith("image/") ?? false;
  const isPdf = item.mimeType === "application/pdf";
  const isSheet =
    !isTextItem && isSheetPreviewable(item.mimeType, item.title);
  const isTextFile =
    !isTextItem &&
    !isSheet &&
    isTextPreviewable(item.mimeType, item.title);

  const { data: detail } = useQuery({
    ...vaultItemQueryOptions(item.id),
    enabled: open && isTextItem,
  });

  const { data: fileText } = useQuery({
    ...vaultFileTextQueryOptions(item.id),
    enabled: open && isTextFile,
  });

  const { data: workbook, isError: sheetError } = useQuery({
    ...vaultSheetQueryOptions(item.id),
    enabled: open && isSheet,
  });

  const textContent = isTextItem
    ? (detail?.content?.trim() || null)
    : (fileText ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[calc(100%-2rem)] overflow-hidden",
          isSheet ? "gap-2 p-2 sm:max-w-5xl" : "sm:max-w-3xl",
        )}
      >
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate pr-8">
            {item.title ?? "Untitled"}
          </DialogTitle>
        </DialogHeader>

        {isTextItem || isTextFile ? (
          <TextPreview
            content={textContent}
            downloadUrl={isTextFile ? fileUrl : undefined}
          />
        ) : isSheet ? (
          sheetError ? (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground">
                Couldn't preview this sheet.{" "}
                <a href={fileUrl} download className="underline">
                  Download it instead
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="h-[70vh] min-w-0 overflow-hidden">
              <SheetViewer
                key={item.id}
                workbook={workbook}
                downloadUrl={fileUrl}
              />
            </div>
          )
        ) : isPdf ? (
          <PdfViewer key={item.id} fileUrl={fileUrl} />
        ) : isImage ? (
          <div className="flex h-[70vh] items-center justify-center overflow-auto">
            <img
              src={fileUrl}
              alt={item.title ?? "Vault file"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-[40vh] flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No preview available for this file.{" "}
              <a href={fileUrl} download className="underline">
                Download it instead
              </a>
              .
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
