import { useQuery } from "@tanstack/react-query";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { vaultItemQueryOptions, type VaultItem } from "@features/vault/api";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function VaultViewer({
  item,
  open,
  onOpenChange,
}: {
  item: VaultItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  const { data: detail } = useQuery({
    ...vaultItemQueryOptions(item.id),
    enabled: open,
  });
  const content = detail?.content?.trim() || null;
  const isTextItem = item.kind === "text";

  const fileUrl = `/api/vault/${item.id}/file`;
  const isImage = item.mimeType?.startsWith("image/") ?? false;
  const isPdf = item.mimeType === "application/pdf";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setNumPages(null);
          setPageNumber(1);
        }
      }}
    >
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item.title ?? "Untitled"}</DialogTitle>
        </DialogHeader>

        {isTextItem ? (
          <div className="flex max-h-[70vh] flex-col gap-3">
            <div className="flex justify-end">
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
            <pre className="overflow-auto whitespace-pre-wrap text-sm text-foreground">
              {content}
            </pre>
          </div>
        ) : (
          <div className="flex max-h-[70vh] flex-col items-center gap-3 overflow-auto">
            {isImage ? (
              <img
                src={fileUrl}
                alt={item.title ?? "Vault file"}
                className="max-h-[65vh] w-auto object-contain"
              />
            ) : isPdf ? (
              <>
                <Document
                  file={fileUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={null}
                  error={
                    <p className="py-8 text-sm text-destructive">
                      Couldn't load this PDF.
                    </p>
                  }
                >
                  <Page pageNumber={pageNumber} width={640} />
                </Document>
                {numPages && numPages > 1 ? (
                  <div className="flex items-center gap-3 text-sm">
                    <Button
                      variant="outline"
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="tabular-nums text-muted-foreground">
                      {pageNumber} / {numPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={pageNumber >= numPages}
                      onClick={() => setPageNumber((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                No preview available for this file.{" "}
                <a href={fileUrl} download className="underline">
                  Download it instead
                </a>
                .
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
