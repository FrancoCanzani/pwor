import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PackSourceDetail } from "@features/packs/api";
import { PdfViewer } from "@features/packs/components/pdf-viewer";
import { SheetViewer } from "@features/packs/components/sheet-viewer";
import { isTextPreviewable } from "@features/packs/lib/preview";
import { isSheetPreviewable, parseSheetWorkbook } from "@features/packs/lib/sheet";
import { originalUrl } from "@features/packs/lib/source-kind";

function TextPreview({
  content,
  downloadUrl,
}: {
  content: string | null;
  downloadUrl?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 justify-end gap-2">
        {downloadUrl ? (
          <Button
            variant="outline"
            size="sm"
            className="font-normal"
            render={<a href={downloadUrl} download />}
          >
            Download
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="font-normal"
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
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-md border border-border">
        {content !== null ? (
          <pre className="whitespace-pre-wrap p-3 text-sm text-foreground">
            {content}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export function SourceOriginalView({
  packId,
  source,
}: {
  packId: string;
  source: PackSourceDetail;
}) {
  const fileUrl = originalUrl(packId, source.id);
  const name = source.title || source.filename;
  const isTextItem = source.type === "text";
  const isImage = source.mimeType?.startsWith("image/") ?? false;
  const isPdf =
    source.mimeType === "application/pdf" ||
    Boolean(name?.toLowerCase().endsWith(".pdf"));
  const isSheet =
    !isTextItem && isSheetPreviewable(source.mimeType, name);
  const isTextFile =
    !isTextItem &&
    !isSheet &&
    isTextPreviewable(source.mimeType, name);
  const hasFileBytes = source.type === "file" || Boolean(source.hash);

  const { data: fileText } = useQuery({
    queryKey: ["pack-source-text", packId, source.id],
    queryFn: async () => {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Failed to load text");
      return response.text();
    },
    enabled: isTextFile && hasFileBytes,
  });

  const { data: workbook, isError: sheetError } = useQuery({
    queryKey: ["pack-source-sheet", packId, source.id],
    queryFn: async () => {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Failed to load sheet");
      return parseSheetWorkbook(await response.arrayBuffer());
    },
    enabled: isSheet && hasFileBytes,
  });

  if (isTextItem) {
    return (
      <TextPreview content={source.content?.trim() || null} />
    );
  }

  if (isTextFile) {
    return (
      <TextPreview
        content={fileText ?? null}
        downloadUrl={fileUrl}
      />
    );
  }

  if (isSheet) {
    if (sheetError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
          <p className="text-sm text-muted-foreground">
            Couldn’t preview this sheet.{" "}
            <a href={fileUrl} download className="underline">
              Download it instead
            </a>
            .
          </p>
        </div>
      );
    }
    return (
      <div className="h-full min-h-0 min-w-0 overflow-hidden">
        <SheetViewer
          key={source.id}
          workbook={workbook}
          downloadUrl={fileUrl}
        />
      </div>
    );
  }

  if (isPdf) {
    return <PdfViewer key={source.id} fileUrl={fileUrl} />;
  }

  if (isImage) {
    return (
      <div className="flex h-full items-center justify-center overflow-auto p-4">
        <img
          src={fileUrl}
          alt={name || "Source image"}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (source.type === "url" && source.sourceUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
        <p className="text-sm text-muted-foreground">
          Open the original URL.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="font-normal"
          render={
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          Open link
        </Button>
      </div>
    );
  }

  if (hasFileBytes) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
        <p className="text-sm text-muted-foreground">
          No inline preview for this file.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="font-normal"
          render={<a href={fileUrl} download />}
        >
          Download
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
      No original available.
    </div>
  );
}
